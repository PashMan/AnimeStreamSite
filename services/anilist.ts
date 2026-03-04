
import { safeLocalStorage } from './safeStorage';

const ANILIST_API = 'https://graphql.anilist.co';
const CACHE_PREFIX = 'anilist_img_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Persistent Cache Helper
const getFromCache = (key: string): string | null | undefined => {
    try {
        const item = safeLocalStorage.getItem(CACHE_PREFIX + key);
        if (item) {
            const parsed = JSON.parse(item);
            if (Date.now() - parsed.timestamp < CACHE_TTL) {
                return parsed.value;
            } else {
                safeLocalStorage.removeItem(CACHE_PREFIX + key);
            }
        }
    } catch (e) { return undefined; }
    return undefined;
};

const saveToCache = (key: string, value: string | null) => {
    try {
        // Clear old items if full
        try {
            const now = Date.now();
            for (let i = 0; i < safeLocalStorage.length; i++) {
                const k = safeLocalStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    const item = JSON.parse(safeLocalStorage.getItem(k) || '{}');
                    if (now - (item.timestamp || 0) > CACHE_TTL) {
                        safeLocalStorage.removeItem(k);
                    }
                }
            }
        } catch (e2) {}
        
        safeLocalStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            value,
            timestamp: Date.now()
        }));
    } catch (e) {
        // If quota exceeded, clear all anilist cache
        try {
             for (let i = 0; i < safeLocalStorage.length; i++) {
                const k = safeLocalStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    safeLocalStorage.removeItem(k);
                }
            }
        } catch (e3) {}
    }
};

// Request queue
const queue: { title: string; resolve: (value: string | null) => void; reject: (reason?: any) => void }[] = [];
let isProcessing = false;
let rateLimitResetTime = 0;

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
        
        // Check cache again just in case
        const cached = getFromCache(title);
        if (cached !== undefined) {
            queue.shift();
            resolve(cached);
            continue;
        }

        try {
            const query = `
            query ($search: String) {
              Media (search: $search, type: ANIME) {
                coverImage {
                  extraLarge
                  large
                }
              }
            }
            `;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(ANILIST_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { search: title }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.status === 429) {
                console.warn('Anilist Rate Limit (429) - Backing off');
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60s
                rateLimitResetTime = Date.now() + waitTime;
                // Don't shift, retry this item after wait
                continue; 
            }

            queue.shift(); // Remove from queue

            if (!response.ok) {
                if (response.status === 404) {
                    saveToCache(title, null);
                    resolve(null);
                } else {
                    // Other errors (500, etc) - don't cache, just return null
                    resolve(null);
                }
            } else {
                const data = await response.json();
                const media = data.data?.Media;
                const imageUrl = media?.coverImage?.extraLarge || media?.coverImage?.large || null;
                saveToCache(title, imageUrl);
                resolve(imageUrl);
            }

        } catch (e: any) {
            console.error('Anilist fetch error:', e);
            queue.shift(); // Remove failed item
            
            // If network error (likely CORS/Rate Limit block), back off
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                 console.warn('Anilist fetch failed (likely CORS/Rate Limit). Backing off 60s.');
                 rateLimitResetTime = Date.now() + 60000;
            }
            
            resolve(null);
        }

        // Strict delay between requests (500ms = ~120 req/min)
        await new Promise(r => setTimeout(r, 500));
    }

    isProcessing = false;
};

export const fetchAnilistImage = (title: string): Promise<string | null> => {
    if (!title) return Promise.resolve(null);
    
    const cached = getFromCache(title);
    if (cached !== undefined) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
        queue.push({ title, resolve, reject });
        processQueue();
    });
};
