import fetch from 'node-fetch';

async function run() {
  const host = "larkin-as.stravers.live";
  
  // Script paths
  const scripts = [
    "/build/runtime.99537932.js",
    "/build/401.3853f8e4.js",
    "/build/app.1216f2e9.js"
  ];

  for (const s of scripts) {
    const url = `https://${host}${s}`;
    console.log(`\n=== Searching inside: ${url} ===`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://stravers.live/'
        }
      });
      if (res.ok) {
        const js = await res.text();
        console.log("JS Length:", js.length);
        
        // Search for patterns
        const patterns = [
          /\/vorf/gi,
          /token/gi,
          /\.php/gi,
          /m3u8/gi,
          /playlist/gi,
          /stream/gi,
          /post/gi,
          /fetch/gi,
          /axios/gi,
          /headers/gi,
          /websocket/gi,
          /link/gi,
          /alloha/gi
        ];
        
        patterns.forEach(pat => {
          const match = js.match(pat);
          if (match) {
            console.log(`Pattern ${pat.toString()} matched ${match.length} times.`);
          }
        });

        // Let's print some matched parts
        // For example, locate occurrences of "m3u8" or "/link" or similar and print around them
        const m3u8Index = js.indexOf('m3u8');
        if (m3u8Index !== -1) {
          console.log("Context around 'm3u8':", js.slice(Math.max(0, m3u8Index - 200), m3u8Index + 200));
        }
        
        const vorfIndex = js.indexOf('vorf');
        if (vorfIndex !== -1) {
          console.log("Context around 'vorf':", js.slice(Math.max(0, vorfIndex - 200), vorfIndex + 200));
        }

        const phpIndex = js.indexOf('.php');
        if (phpIndex !== -1) {
          console.log("Context around '.php':", js.slice(Math.max(0, phpIndex - 200), phpIndex + 200));
        }

      } else {
        console.log("Status:", res.status);
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

run();
