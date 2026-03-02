
interface Env {
  // Add environment variables here if needed
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;
  const url = new URL(request.url);
  
  // Extract the path after /api/shikimori
  // params.path is an array of path segments
  const pathSegments = params.path as string[] || [];
  const path = pathSegments.join('/');
  const search = url.search;

  const targetUrl = `https://shikimori.one/api/${path}${search}`;

  try {
    // Clone the request to modify headers
    const newHeaders = new Headers(request.headers);
    newHeaders.set('User-Agent', 'AnimeStream/1.0');
    newHeaders.set('Referer', 'https://shikimori.one/');
    newHeaders.set('Accept', 'application/json');

    // Remove headers that might cause issues
    newHeaders.delete('Host');
    newHeaders.delete('Cf-Connecting-Ip');
    newHeaders.delete('X-Forwarded-For');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: 'follow'
    });

    // Create a new response to modify headers
    const newResponse = new Response(response.body, response);
    
    // Set CORS headers
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error', details: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
