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
  console.log("Downloaded, length:", js.length);

  // Search for lists.php
  let idx = 0;
  while ((idx = js.indexOf('lists.php', idx)) !== -1) {
    console.log(`\n=== Match for lists.php at index ${idx} ===`);
    console.log(js.slice(idx - 100, idx + 100));
    idx += 9;
  }

  // Search for vorf
  let vIdx = 0;
  while ((vIdx = js.indexOf('vorf', vIdx)) !== -1) {
    console.log(`\n=== Match for vorf at index ${vIdx} ===`);
    console.log(js.slice(vIdx - 100, vIdx + 100));
    vIdx += 4;
  }
}

test();
