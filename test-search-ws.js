import fetch from 'node-fetch';

async function run() {
  const host = "larkin-as.stravers.live";
  const url = `https://${host}/build/app.1216f2e9.js`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://stravers.live/'
      }
    });
    if (res.ok) {
      const js = await res.text();
      
      const idx = js.indexOf('WebSocket');
      if (idx !== -1) {
        console.log("=== WebSocket context ===");
        console.log(js.slice(Math.max(0, idx - 500), idx + 1000));
      }
      
      const idx2 = js.indexOf('ws:');
      if (idx2 !== -1) {
        console.log("=== 'ws:' context ===");
        console.log(js.slice(Math.max(0, idx2 - 500), idx2 + 1000));
      }

      const idx3 = js.indexOf('wss:');
      if (idx3 !== -1) {
        console.log("=== 'wss:' context ===");
        console.log(js.slice(Math.max(0, idx3 - 500), idx3 + 1000));
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
