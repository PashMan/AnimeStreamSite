export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  
  // Handle CORS preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const path = url.pathname.replace(/^\/api\/shikimori/, '');
  const targetUrl = `https://shikimori.one/api${path}${url.search}`;

  // Create new headers
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  headers.set('Referer', 'https://shikimori.one/');
  headers.set('Accept', 'application/json, text/plain, */*');
  
  // Forward Authorization header if present (for OAuth)
  const authHeader = context.request.headers.get('Authorization');
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const init = {
    method: context.request.method,
    headers: headers,
    body: undefined as any
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
    const contentType = context.request.headers.get('Content-Type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
  }

  try {
    const response = await fetch(targetUrl, init);

    // Re-create response headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    
    // Remove security headers that might block embedding
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
};
