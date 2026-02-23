
export const runtime = 'edge';

export default async function handler(req: Request) {
  const url = new URL(req.url);
  // Extract the path after /api/shikimori
  // Example: /api/shikimori/animes?limit=20 -> /animes?limit=20
  const path = url.pathname.replace('/api/shikimori', '');
  const search = url.search;
  
  const targetUrl = `https://shikimori.one/api${path}${search}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'AnimeStream-Vercel-Proxy',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Shikimori API error: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Proxy error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
