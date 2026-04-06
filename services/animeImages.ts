
import { getFromStorage, saveToStorage } from './cache';

const SHIKIMORI_API = 'https://shikimori.one/api/animes';
const ANILIST_API = 'https://graphql.anilist.co';
const KODIK_API = '/api/kodik/search';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Request queue
const queue: { title: string; resolve: (value: string | null) => void; reject: (reason?: any) => void }[] = [];
let isProcessing = false;
let rateLimitResetTime = 0;

const fetchFromAniList = async (title: string): Promise<string | null> => {
    try {
        const query = `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;

        const response = await fetch(ANILIST_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query,
                variables: { search: title }
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        const cover = data?.data?.Media?.coverImage;
        return cover?.extraLarge || cover?.large || cover?.medium || null;
    } catch {
        return null;
    }
};

const fetchFromKodik = async (title: string): Promise<string | null> => {
    try {
        const response = await fetch(`${KODIK_API}?title=${encodeURIComponent(title)}`);
        if (!response.ok) return null;
        const data = await response.json() as any;
        const first = Array.isArray(data?.results) ? data.results[0] : null;
        const poster = first?.material_data?.poster_url || first?.material_data?.poster;
        return poster || null;
    } catch {
        return null;
    }
};

const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
        // Check rate limit
        const now = Date.now();
        if (now < rateLimitResetTime) {
            const waitTime = rateLimitResetTime - now;
            await new Promise(r => setTimeout(r, waitTime));
        }

        const currentItem = queue[0]; // Peek
        const { title, resolve } = currentItem;
        
        // Check cache again
        const cached = getFromStorage(`anime_cover_${title}`);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            queue.shift();
            resolve(cached.data);
            continue;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(`${SHIKIMORI_API}?search=${encodeURIComponent(title)}&limit=1`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    // User-Agent is recommended by Shikimori
                    'User-Agent': 'AnimeApp/1.0'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.status === 429) {
                console.warn('Shikimori Rate Limit (429) - Backing off');
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000; // Default 5s
                rateLimitResetTime = Date.now() + waitTime;
                // Don't shift, retry this item after wait
                continue; 
            }

            queue.shift(); // Remove from queue

            if (!response.ok) {
                const aniListImage = await fetchFromAniList(title);
                if (aniListImage) {
                    saveToStorage(`anime_cover_${title}`, aniListImage);
                    resolve(aniListImage);
                } else {
                    const kodikImage = await fetchFromKodik(title);
                    if (kodikImage) {
                        saveToStorage(`anime_cover_${title}`, kodikImage);
                        resolve(kodikImage);
                    } else {
                        resolve(null);
                    }
                }
            } else {
                const data = await response.json();
                if (data && data.length > 0 && data[0].image?.original) {
                    const imageUrl = `https://shikimori.one${data[0].image.original}`;
                    saveToStorage(`anime_cover_${title}`, imageUrl);
                    resolve(imageUrl);
                } else {
                    const aniListImage = await fetchFromAniList(title);
                    if (aniListImage) {
                        saveToStorage(`anime_cover_${title}`, aniListImage);
                        resolve(aniListImage);
                    } else {
                        const kodikImage = await fetchFromKodik(title);
                        if (kodikImage) {
                            saveToStorage(`anime_cover_${title}`, kodikImage);
                            resolve(kodikImage);
                        } else {
                            resolve(null);
                        }
                    }
                }
            }

        } catch (e: any) {
            if (e.name !== 'AbortError' && !e.message?.includes('aborted')) {
                console.error('Shikimori fetch error:', e);
            }
            queue.shift(); // Remove failed item
            
            // If network error, back off
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                 console.warn('Shikimori fetch failed. Backing off 5s.');
                 rateLimitResetTime = Date.now() + 5000;
            }
            
            resolve(null);
        }

        // Strict delay between requests (1000ms = 60 req/min) to respect Shikimori's 90 req/min limit
        await new Promise(r => setTimeout(r, 1000));
    }

    isProcessing = false;
};

export const fetchAnimeImage = (title: string): Promise<string | null> => {
    if (!title) return Promise.resolve(null);
    
    const cached = getFromStorage(`anime_cover_${title}`);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return Promise.resolve(cached.data);
    }

    return new Promise((resolve, reject) => {
        queue.push({ title, resolve, reject });
        processQueue();
    });
};
