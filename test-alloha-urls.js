import fetch from 'node-fetch';

async function testAllohaUrls() {
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  const vorfRes = await fetch(`https://${host}/vorf`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': targetUrl,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5'
    },
    body: 'token=d317441359e505c343c2063edc97e7&token_movie=9c40cb0e1e9af056f56de910be1ec1'
  });
  const vorfData = await vorfRes.json();
  const token = vorfData.token;
  console.log("Token obtained length:", token?.length);

  const testUrls = [
    `https://${host}/vod/1372179.m3u8`,
    `https://${host}/vod/1372339.m3u8`,
    `https://${host}/hls/1372179.m3u8`,
    `https://${host}/hls/1372339.m3u8`,
    `https://${host}/1372179.m3u8`,
    `https://${host}/1372339.m3u8`,
    `https://${host}/m3u8/${token}`,
    `https://${host}/playlist/${token}.m3u8`,
    `https://${host}/stream/${token}.m3u8`,
    `https://${host}/vod/${token}.m3u8`,
    `https://${host}/hls/${token}/index.m3u8`,
    `https://${host}/hls/${token}/master.m3u8`,
    `https://${host}/index.m3u8?token=${token}`,
    `https://${host}/master.m3u8?token=${token}`,
    `https://${host}/playlist.m3u8?token=${token}`,
    `https://${host}/file/1372179.m3u8`,
    `https://${host}/e/1372179.m3u8`,
    `https://${host}/video/1372179.m3u8`
  ];

  for (const url of testUrls) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': targetUrl,
          'Authorizations': `Bearer ${token}`,
          'X-Forwarded-For': '185.220.101.5',
          'X-Real-IP': '185.220.101.5'
        }
      });
      console.log(`URL: ${url} -> Status: ${r.status}, Content-Type: ${r.headers.get('content-type')}`);
      if (r.ok) {
        const txt = await r.text();
        console.log("--> SUCCESS BODY:", txt.slice(0, 300));
      }
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testAllohaUrls();
