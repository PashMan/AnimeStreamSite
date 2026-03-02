interface Env {
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;
  const url = new URL(request.url);
  
  // Extract the path after /api/image
  const pathSegments = params.path as string[] || [];
  const path = pathSegments.join('/');
  const search = url.search;

  const targetUrl = `https://shikimori.one/${path}${search}`;

  try {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('User-Agent', 'AnimeStream/1.0');
    newHeaders.set('Referer', 'https://shikimori.one/');
    
    // Remove headers that might cause issues
    newHeaders.delete('Host');
    newHeaders.delete('Cf-Connecting-Ip');
    newHeaders.delete('X-Forwarded-For');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      redirect: 'follow'
    });

    const newResponse = new Response(response.body, response);
    
    // Set CORS and Cache headers
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');

    return newResponse;
  } catch (error) {
    return new Response('Error proxying image', { status: 500 });
  }
};
