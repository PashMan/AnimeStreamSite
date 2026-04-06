export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Extract all search params
  const searchParams = url.searchParams;
  
  const KODIK_DOMAINS = [
    'kodikapi.com',
    'kodikapi.cc',
    'kodikapi.info',
    'kodikapi.biz'
  ];

  let lastError = null;

  for (const domain of KODIK_DOMAINS) {
    try {
      // Construct the Kodik API URL
      const kodikUrl = new URL(`https://${domain}/search`);
      searchParams.forEach((value, key) => {
        kodikUrl.searchParams.append(key, value);
      });

      const response = await fetch(kodikUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Kodik API responded with ${response.status}`);
      }

      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (error) {
      lastError = error;
      // Continue to the next domain
    }
  }

  return new Response(JSON.stringify({ error: 'All Kodik endpoints failed', details: (lastError as Error)?.message }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
