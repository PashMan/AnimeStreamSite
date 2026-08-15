import fetch from 'node-fetch';

async function searchVorfCode() {
  const host = "https://larkin-as.stravers.live";
  const files = ["/build/401.3853f8e4.js", "/build/app.1216f2e9.js"];

  for (const f of files) {
    const res = await fetch(host + f, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': host + '/',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      }
    });
    const js = await res.text();
    
    let idx = 0;
    while ((idx = js.indexOf('/vorf', idx)) !== -1) {
      console.log(`=== Match for /vorf in ${f} at index ${idx} ===`);
      console.log(js.slice(Math.max(0, idx - 200), Math.min(js.length, idx + 500)));
      idx += 5;
    }

    let idx2 = 0;
    while ((idx2 = js.indexOf('/lists.php', idx2)) !== -1) {
      console.log(`=== Match for /lists.php in ${f} at index ${idx2} ===`);
      console.log(js.slice(Math.max(0, idx2 - 200), Math.min(js.length, idx2 + 500)));
      idx2 += 10;
    }
  }
}

searchVorfCode();
