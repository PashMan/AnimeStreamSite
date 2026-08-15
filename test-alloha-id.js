import fetch from 'node-fetch';

async function testAllohaIdFile() {
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  // 1. Fetch vorf token
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
  console.log("vorfData:", vorfData);

  const authToken = vorfData.token;

  // Let's test POST to /vorf with id_file or id or episode or season or file
  const testBodies = [
    { file: '1372179', token: 'd317441359e505c343c2063edc97e7', token_movie: '9c40cb0e1e9af056f56de910be1ec1' },
    { id_file: '1372179', token: 'd317441359e505c343c2063edc97e7', token_movie: '9c40cb0e1e9af056f56de910be1ec1' },
    { id: '1372339', token: 'd317441359e505c343c2063edc97e7', token_movie: '9c40cb0e1e9af056f56de910be1ec1' },
    { vorf: authToken, file: '1372179' },
    { token: authToken, file: '1372179' },
    { token: authToken, id: '1372339' },
  ];

  for (const b of testBodies) {
    const r = await fetch(`https://${host}/vorf`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': targetUrl,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      },
      body: new URLSearchParams(b).toString()
    });
    console.log("POST /vorf body:", JSON.stringify(b), "-> status:", r.status, "resp:", await r.text());
  }
}

testAllohaIdFile();
