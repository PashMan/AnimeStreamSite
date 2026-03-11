export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/kodik-proxy/, '');
  const targetUrl = `https://kodikapi.com${path}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set('Host', 'kodikapi.com');
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  headers.set('Referer', 'https://kodikapi.com/');

  const init: RequestInit = {
    method: context.request.method,
    headers: headers,
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
  }

  try {
    const response = await fetch(targetUrl, init);

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('X-Frame-Options');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
