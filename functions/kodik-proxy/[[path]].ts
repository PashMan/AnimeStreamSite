export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  // Формируем целевой URL с параметрами
  const targetUrl = `https://kodikapi.com${url.pathname.replace(/^\/kodik-proxy/, '')}${url.search}`;

  // Создаем чистые заголовки, не копируя заголовки клиента
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (compatible; Proxy/1.0)');
  headers.set('Accept', 'application/json');

  try {
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: headers,
    });

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
