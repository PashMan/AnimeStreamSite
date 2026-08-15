import fetch from 'node-fetch';

async function testAllohaStream() {
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  console.log("1. Fetching vorf token...");
  const vorfRes = await fetch(`https://${host}/vorf`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Referer': targetUrl,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5'
    },
    body: 'token=d317441359e505c343c2063edc97e7&token_movie=9c40cb0e1e9af056f56de910be1ec1'
  });

  const vorfData = await vorfRes.json();
  console.log("Vorf data:", vorfData);

  if (vorfData.token) {
    const authToken = vorfData.token;
    
    // Let's test calling /lists.php or /link or websocket or vkvideo with token
    console.log("2. Testing /lists.php with token...");
    const listsRes = await fetch(`https://${host}/lists.php`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': targetUrl,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      },
      body: `token=${encodeURIComponent(authToken)}`
    });
    console.log("lists.php status:", listsRes.status);
    console.log("lists.php body:", await listsRes.text());

    // Let's also test GET/POST to various possible endpoints
    const endpointsToTry = [
      `/link`, `/m3u8`, `/file`, `/playlist`, `/stream`, `/get_file`, `/video`
    ];

    for (const ep of endpointsToTry) {
      try {
        const epRes = await fetch(`https://${host}${ep}?token=${encodeURIComponent(authToken)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': targetUrl,
            'X-Forwarded-For': '185.220.101.5',
            'X-Real-IP': '185.220.101.5'
          }
        });
        console.log(`Endpoint GET ${ep} status:`, epRes.status, "Length:", (await epRes.text()).length);
      } catch (e) {}
    }
  }
}

testAllohaStream();
