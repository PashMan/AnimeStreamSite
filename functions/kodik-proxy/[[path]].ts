export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/kodik-proxy/, '');
  const targetUrl = `https://kodikapi.com${path}${url.search}`;

  // Пересылаем запрос как есть, меняя только хост
  const newRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  try {
    const response = await fetch(newRequest);

    // Добавляем CORS заголовки к ответу
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
