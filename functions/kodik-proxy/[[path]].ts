export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/kodik-proxy', '');
  const targetUrl = `https://kodikapi.com${path}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.delete('Host');
  headers.delete('Origin');
  headers.delete('Referer');

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers: headers,
    body: context.request.body,
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};
