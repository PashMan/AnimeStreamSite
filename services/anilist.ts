
const ANILIST_API = 'https://graphql.anilist.co';

// Simple cache to avoid redundant requests
const cache = new Map<string, string | null>();

// Request queue to respect rate limits (90 req/min = ~1.5 req/sec)
// We'll be conservative and do max 2 requests per second
const queue: { title: string; resolve: (value: string | null) => void; reject: (reason?: any) => void }[] = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    while (queue.length > 0) {
        const { title, resolve, reject } = queue.shift()!;
        
        try {
            if (cache.has(title)) {
                resolve(cache.get(title)!);
                continue;
            }

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

            const response = await fetch(ANILIST_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { search: title }
                })
            });

            if (response.status === 429) {
                // Rate limited
                console.warn('Anilist Rate Limit - Backing off');
                queue.unshift({ title, resolve, reject });
                await new Promise(r => setTimeout(r, 2000)); // 2s wait
                continue;
            }

            if (!response.ok) {
                resolve(null);
            } else {
                const data = await response.json();
                const media = data.data?.Media;
                const imageUrl = media?.coverImage?.extraLarge || media?.coverImage?.large || null;
                cache.set(title, imageUrl);
                resolve(imageUrl);
            }

        } catch (e) {
            console.error('Anilist fetch error:', e);
            resolve(null);
        }

        // Delay between requests (500ms = 2 req/sec, safe within 90/min)
        await new Promise(r => setTimeout(r, 500));
    }

    isProcessing = false;
};

export const fetchAnilistImage = (title: string): Promise<string | null> => {
    if (!title) return Promise.resolve(null);
    if (cache.has(title)) return Promise.resolve(cache.get(title)!);

    return new Promise((resolve, reject) => {
        queue.push({ title, resolve, reject });
        processQueue();
    });
};
