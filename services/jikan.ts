
const BASE_URL = 'https://api.jikan.moe/v4';

// Simple in-memory cache
const cache = new Map<string, string | null>();

// Request queue
const queue: { malId: string; resolve: (value: string | null) => void; reject: (reason?: any) => void }[] = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    while (queue.length > 0) {
        const { malId, resolve, reject } = queue.shift()!;
        
        try {
            // Check cache again just in case
            if (cache.has(malId)) {
                resolve(cache.get(malId)!);
                continue;
            }

            const res = await fetch(`${BASE_URL}/anime/${malId}`);
            
            if (!res.ok) {
                if (res.status === 404) {
                    cache.set(malId, null);
                    resolve(null);
                } else if (res.status === 429) {
                    // If rate limited, put back in front of queue and wait longer
                    console.warn('Jikan API Rate Limit Hit - Backing off');
                    queue.unshift({ malId, resolve, reject });
                    await new Promise(r => setTimeout(r, 2000)); // 2s backoff
                    continue;
                } else {
                    // Other errors
                    resolve(null);
                }
            } else {
                const data = await res.json();
                const images = data.data?.images;
                const imageUrl = images?.webp?.large_image_url || 
                               images?.jpg?.large_image_url || 
                               images?.webp?.image_url || 
                               images?.jpg?.image_url || 
                               null;
                
                cache.set(malId, imageUrl);
                resolve(imageUrl);
            }

        } catch (e) {
            console.error('Jikan fetch error:', e);
            resolve(null);
        }

        // Rate limit delay: Jikan allows ~3 req/sec, so wait ~350ms
        await new Promise(r => setTimeout(r, 350));
    }

    isProcessing = false;
};

export const fetchJikanImage = (malId: string): Promise<string | null> => {
  // Check cache first
  if (cache.has(malId)) {
      return Promise.resolve(cache.get(malId)!);
  }

  return new Promise((resolve, reject) => {
      queue.push({ malId, resolve, reject });
      processQueue();
  });
};
