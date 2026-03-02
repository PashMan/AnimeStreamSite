export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/api/image', '');
  const targetUrl = `https://shikimori.one${path}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set('User-Agent', 'AnimeStream/1.0');
  headers.set('Referer', 'https://shikimori.one/');
  
  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers: headers,
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Cache-Control', 'public, max-age=31536000');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};
