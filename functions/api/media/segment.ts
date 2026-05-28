export async function onRequest(context: any) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const rawUrl = request.url;
  let segmentUrl = '';
  const urlIndex = rawUrl.indexOf('url=');
  if (urlIndex !== -1) {
    const extracted = rawUrl.substring(urlIndex + 4);
    try {
      segmentUrl = decodeURIComponent(extracted);
    } catch (err) {
      segmentUrl = new URL(rawUrl).searchParams.get('url') || '';
    }
  } else {
    segmentUrl = new URL(rawUrl).searchParams.get('url') || '';
  }

  if (!segmentUrl) {
    return new Response(JSON.stringify({ error: 'No segment URL provided' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const segmentUrlObj = new URL(segmentUrl);
    const referer = `https://${segmentUrlObj.host}/` || 'https://kodik.info/';

    const reqHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Referer': referer,
      'Accept': '*/*'
    };
    const incomingRange = request.headers.get('range');
    if (incomingRange) {
      reqHeaders['Range'] = incomingRange;
    }

    const response = await fetch(segmentUrl, {
      headers: reqHeaders
    });

    if (!response.ok && response.status !== 206) {
       return new Response(`Error fetching segment: ${response.status}`, { 
         status: response.status,
         headers: { 'Access-Control-Allow-Origin': '*' }
       });
    }

    const arrayBuffer = await response.arrayBuffer();

    const resHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('content-type') || 'video/mp2t',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      resHeaders['Content-Range'] = contentRange;
    }
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      resHeaders['Accept-Ranges'] = acceptRanges;
    }

    return new Response(arrayBuffer, {
      status: response.status,
      headers: resHeaders
    });
  } catch (e: any) {
    return new Response('Exception during segment fetch: ' + e.message, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      }
    });
  }
}
