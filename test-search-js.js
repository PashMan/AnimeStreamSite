import fetch from 'node-fetch';

async function findVorfHandler() {
  const host = "https://larkin-as.stravers.live";
  const res = await fetch(host + "/build/app.1216f2e9.js", {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': host + '/',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5'
    }
  });
  const js = await res.text();
  console.log("JS total length:", js.length);

  // Search around '/vorf'
  const pos = js.indexOf("'/vorf'");
  if (pos !== -1) {
    console.log("Found '/vorf' at", pos);
    // Print 1000 chars before and 2000 chars after
    console.log("--- BEFORE AND AFTER '/vorf' ---");
    console.log(js.slice(Math.max(0, pos - 500), Math.min(js.length, pos + 1500)));
  }

  // Also search for "wss:" or "ws:" or "vkvideo"
  const wsPos = js.indexOf("wss:");
  if (wsPos !== -1) {
    console.log("Found 'wss:' at", wsPos);
    console.log(js.slice(Math.max(0, wsPos - 200), Math.min(js.length, wsPos + 500)));
  }
}

findVorfHandler();
