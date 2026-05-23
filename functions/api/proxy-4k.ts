function convertChar(char: string, rotNum: number): string {
  if (!char.match(/[a-zA-Z]/)) return char;
  const code = char.charCodeAt(0);
  let start = 65; // 'A'
  if (code >= 97) start = 97; // 'a'
  return String.fromCharCode(((code - start + rotNum) % 26) + start);
}

function decodeKodikUrl(encoded: string, rotNum?: number): string {
  if (rotNum !== undefined) {
    const crypted = encoded.split('').map(c => convertChar(c, rotNum)).join('');
    const padding = (4 - (crypted.length % 4)) % 4;
    try {
      const decoded = atob(crypted + '='.repeat(padding));
      if (decoded.includes('mp4:hls:manifest')) return decoded;
    } catch {}
  }
  for (let rot = 0; rot < 26; rot++) {
    const crypted = encoded.split('').map(c => convertChar(c, rot)).join('');
    const padding = (4 - (crypted.length % 4)) % 4;
    try {
      const decoded = atob(crypted + '='.repeat(padding));
      if (decoded.includes('mp4:hls:manifest')) {
         return decoded;
      }
    } catch {}
  }
  throw new Error('Decryption of Kodik stream URL failed');
}

function getProxyOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'http';
  let host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host || 'localhost:3000';
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host;
  }
  return `${proto}://${host}`;
}

export async function onRequest(context: any) {
  const { request } = context;
  
  // Handle preflight OPTIONS request
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

  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');
  if (!targetUrl) {
    return new Response('Missing url parameter', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return new Response(`Proxy failed with status ${res.status}`, {
        status: res.status,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.includes('.m3u8')) {
      const text = await res.text();
      
      // Validation: Ensure the playlist starts with #EXTM3U (not HTML error or blank page)
      if (!text || !text.trim().startsWith('#EXTM3U')) {
        console.error(`[PROXY-4K] Invalid M3U8 payload from target: ${targetUrl}. Res length: ${text?.length || 0}. Starts with:`, text ? text.slice(0, 500) : "empty");
        return new Response('Error: Proxy loaded an invalid M3U8 manifest. The source might be blocking or offline.', {
          status: 502,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }

      const parentUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      
      // Clean CRLF and split cleanly to avoid breaking tags
      const lines = text.replace(/\r/g, '').split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        
        let absUrl = trimmed;
        if (!trimmed.startsWith('http')) {
          absUrl = trimmed.startsWith('/')
            ? new URL(trimmed, targetUrl).toString()
            : parentUrl + trimmed;
        }
        return `${getProxyOrigin(request)}/api/proxy-4k?url=${encodeURIComponent(absUrl)}`;
      });
      
      return new Response(rewrittenLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache'
        }
      });
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });

  } catch (err: any) {
    return new Response(`Proxy Exception: ${err.message}`, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
