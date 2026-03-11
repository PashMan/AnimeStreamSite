export const onRequest = async (context: any) => {
  const requestUrl = new URL(context.request.url);
  
  // Извлекаем путь после /kodik-proxy
  const path = requestUrl.pathname.replace(/^\/kodik-proxy/, '');
  
  // Создаем новый URL для Kodik API
  const targetUrl = new URL(`https://kodikapi.com${path}`);
  
  // ЯВНО копируем все параметры запроса (включая token)
  requestUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  // Создаем чистые заголовки
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  headers.set('Accept', 'application/json');

  try {
    const response = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ 
        error: `Kodik API error: ${response.status}`, 
        details: errorText,
        requestedUrl: targetUrl.toString() 
      }), { 
        status: response.status,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

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
    return new Response(JSON.stringify({ error: String(e), targetUrl: targetUrl.toString() }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
