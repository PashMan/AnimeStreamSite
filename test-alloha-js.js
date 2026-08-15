import fetch from 'node-fetch';

async function inspectBuildJs() {
  const host = "https://larkin-as.stravers.live";
  const files = ["/build/runtime.99537932.js", "/build/401.3853f8e4.js", "/build/app.1216f2e9.js"];

  for (const f of files) {
    console.log(`=== Fetching ${f} ===`);
    const res = await fetch(host + f, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': host + '/',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      }
    });
    const js = await res.text();
    console.log(`Length: ${js.length}`);
    
    // Search for fetch / axios / post / url endpoints / vkvideo / m3u8
    const endpoints = js.match(/\/api\/[a-zA-Z0-9_/]+|\/[a-zA-Z0-9_/]+\.php|\/vorf|\/link|\/file|\/playlist/g);
    if (endpoints) {
      console.log("Found endpoints:", Array.from(new Set(endpoints)));
    }

    // Search for fetch or xhr calls
    const xhrMatches = js.match(/(?:fetch|post|get|ajax)\s*\(\s*["']([^"']+)["']/g);
    if (xhrMatches) {
      console.log("XHR/Fetch calls:", Array.from(new Set(xhrMatches)));
    }
  }
}

inspectBuildJs();
