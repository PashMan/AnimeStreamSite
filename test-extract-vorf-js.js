import fetch from 'node-fetch';

async function test() {
  const host = "https://larkin-as.stravers.live";
  const f = "/build/app.1216f2e9.js";
  console.log(`Downloading ${host + f}...`);
  const res = await fetch(host + f, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': host + '/',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5'
    }
  });
  const js = await res.text();
  console.log("Length:", js.length);

  let idx = 0;
  while ((idx = js.indexOf('/vorf', idx)) !== -1) {
    console.log(`=== Match for /vorf in ${f} at index ${idx} ===`);
    console.log(js.slice(Math.max(0, idx - 400), Math.min(js.length, idx + 400)));
    idx += 5;
  }
}

test();
