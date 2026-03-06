
import { getFromStorage, saveToStorage } from './cache';

const ANILIST_API = '/api/anilist';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

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
        
        // Check cache again
        const cached = getFromStorage(`anilist_${title}`);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            queue.shift();
            resolve(cached.data);
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
                resolve(null);
            } else {
                const data = await response.json();
                const media = data.data?.Media;
                const imageUrl = media?.coverImage?.extraLarge || media?.coverImage?.large || null;
                saveToStorage(`anilist_${title}`, imageUrl);
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
    
    const cached = getFromStorage(`anilist_${title}`);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return Promise.resolve(cached.data);
    }

    return new Promise((resolve, reject) => {
        queue.push({ title, resolve, reject });
        processQueue();
    });
};
