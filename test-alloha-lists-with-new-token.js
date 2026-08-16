import fetch from 'node-fetch';

async function run() {
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  console.log("1. Calling /vorf to get the verified token...");
  const vorfRes = await fetch(`https://${host}/vorf`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': targetUrl,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5'
    },
    body: new URLSearchParams({
      token: 'd317441359e505c343c2063edc97e7',
      token_movie: '9c40cb0e1e9af056f56de910be1ec1',
      id_file: '1372179',
      file: '1372179',
      id: '1372339'
    }).toString()
  });

  const vorfData = await vorfRes.json();
  console.log("Vorf response:", vorfData);

  if (!vorfData.ok || !vorfData.token) {
    console.log("Failed to get token from /vorf");
    return;
  }

  const newToken = vorfData.token;
  console.log("\n2. Testing /lists.php with the new verified token...");

  // Let's try various parameter combinations for lists.php
  const listTrials = [
    { token: newToken },
    { token: newToken, file: '1372179' },
    { token: newToken, id_file: '1372179' },
    { token: newToken, id: '1372339' },
    { token: newToken, id_file: '1372179', id: '1372339' },
  ];

  for (const [i, bodyObj] of listTrials.entries()) {
    console.log(`\nTrial ${i + 1}: POST /lists.php with body:`, JSON.stringify(bodyObj));
    const listsRes = await fetch(`https://${host}/lists.php`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': targetUrl,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      },
      body: new URLSearchParams(bodyObj).toString()
    });

    console.log(`Status: ${listsRes.status}`);
    const text = await listsRes.text();
    console.log(`Response length: ${text.length}`);
    try {
      const json = JSON.parse(text);
      console.log("Response JSON:", json);
    } catch (_) {
      console.log("Response Text (truncated):", text.slice(0, 300));
    }
  }
}

run();
