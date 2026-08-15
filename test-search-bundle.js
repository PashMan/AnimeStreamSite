import fetch from 'node-fetch';

async function findBundleCode() {
  const host = "https://larkin-as.stravers.live";
  const res = await fetch(host + "/build/401.3853f8e4.js", {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': host + '/',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5'
    }
  });
  const js = await res.text();
  console.log("401.js total length:", js.length);

  // Search for vorf or fileList or token or m3u8
  const matches = ["vorf", "fileList", "vkvideo", "m3u8", "Authorizations"];
  for (const m of matches) {
    let pos = 0;
    while ((pos = js.indexOf(m, pos)) !== -1) {
      console.log(`Match for '${m}' at ${pos}:`);
      console.log(js.slice(Math.max(0, pos - 150), Math.min(js.length, pos + 250)));
      console.log("---");
      pos += m.length + 10;
      if (pos > 500000) break; // cap matches
    }
  }
}

findBundleCode();
