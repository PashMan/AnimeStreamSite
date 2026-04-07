const JIKAN_API = 'https://api.jikan.moe/v4/anime';

const extractAnimeIdFromPath = (path: string): string | null => {
  const match = path.match(/\/(\d+)\.(jpg|jpeg|png|webp)$/i);
  return match ? match[1] : null;
};

const imageHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://shikimori.one/',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
};

export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const path = url.pathname.replace(/^\/api\/image/, '');
  const targetUrl = `https://shikimori.one${path}${url.search}`;

  const cache = (caches as any).default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);

  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set('X-Image-Cache', 'HIT');
    return hit;
  }

  try {
    const shikiRes = await fetch(targetUrl, {
      method: 'GET',
      headers: imageHeaders,
    });

    if (shikiRes.ok) {
      const newHeaders = new Headers(shikiRes.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('X-Frame-Options');
      newHeaders.delete('Vary');
      newHeaders.delete('Set-Cookie');

      const response = new Response(shikiRes.body, {
        status: shikiRes.status,
        statusText: shikiRes.statusText,
        headers: newHeaders,
      });

      context.waitUntil(cache.put(cacheKey, response.clone()));

      const miss = new Response(response.body, response);
      miss.headers.set('X-Image-Cache', 'MISS');
      miss.headers.set('X-Image-Source', 'Shikimori');
      return miss;
    }

    // Shikimori failed: try Jikan fallback by anime id from filename
    const animeId = extractAnimeIdFromPath(path);
    if (animeId) {
      const jikanRes = await fetch(`${JIKAN_API}/${animeId}`);
      if (jikanRes.ok) {
        const jikanData = await jikanRes.json() as any;
        const imageUrl =
          jikanData?.data?.images?.jpg?.large_image_url ||
          jikanData?.data?.images?.jpg?.image_url ||
          jikanData?.data?.images?.webp?.large_image_url ||
          jikanData?.data?.images?.webp?.image_url;

        if (imageUrl) {
          const imageRes = await fetch(imageUrl);
          if (imageRes.ok) {
            const headers = new Headers(imageRes.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
            headers.set('X-Image-Source', 'Jikan-Fallback');

            const fallbackResponse = new Response(imageRes.body, {
              status: 200,
              headers
            });

            context.waitUntil(cache.put(cacheKey, fallbackResponse.clone()));
            return fallbackResponse;
          }
        }
      }
    }

    return new Response(shikiRes.body, {
      status: shikiRes.status,
      statusText: shikiRes.statusText,
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
        'X-Image-Source': 'Shikimori-Error'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
