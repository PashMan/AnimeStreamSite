export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  // Просто меняем хост с нашего на kodikapi.com, сохраняя путь и параметры
  const targetUrl = `https://kodikapi.com${url.pathname.replace(/^\/kodik-proxy/, '')}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), targetUrl }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
