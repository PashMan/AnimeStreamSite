import { extractBalancersM3u8 } from '../../../utils/balancerExtractor';

export async function onRequest(context: any) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  }

  const urlObj = new URL(request.url);
  let urlParam = urlObj.searchParams.get('url');

  if (!urlParam && request.method === 'POST') {
    try {
      const body = await request.json();
      urlParam = body?.url;
    } catch {}
  }

  if (!urlParam) {
    return new Response(JSON.stringify({ error: 'Provide ?url= parameter or JSON body { url: "..." }' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  let iframeUrl = urlParam.startsWith('//') ? `https:${urlParam}` : urlParam;
  const result = await extractBalancersM3u8(iframeUrl);

  return new Response(JSON.stringify({
    url: iframeUrl,
    success: !!result.m3u8Url,
    extractedM3u8: result.m3u8Url,
    htmlLength: result.htmlLength,
    logs: result.logs
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
