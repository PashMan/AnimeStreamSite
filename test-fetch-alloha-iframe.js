import fetch from 'node-fetch';

async function run() {
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  const refs = [
    `https://stravers.live/`,
    `https://${host}/`,
    `https://alloha.tv/`,
    `https://alloha.net/`,
    `https://kinopoisk.ru/`,
    `https://shikimori.one/`,
    `https://anilibria.tv/`
  ];

  for (const ref of refs) {
    console.log(`\n=== Fetching with Referer: ${ref} ===`);
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': ref,
          'X-Forwarded-For': '185.220.101.5',
          'X-Real-IP': '185.220.101.5',
          'Client-IP': '185.220.101.5',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      console.log("Status:", res.status);
      const text = await res.text();
      console.log("Body length:", text.length);
      if (text.length > 500) {
        console.log("Snippet (first 800 chars):");
        console.log(text.slice(0, 800));
        
        // Scan for keys
        const matchFile = text.match(/file\s*:\s*["']([\s\S]*?)["']/g);
        console.log("file matches:", matchFile);
        const matchFileList = text.match(/fileList/g);
        console.log("fileList found:", !!matchFileList);
        
        // Let's print out script tags contents
        const scripts = text.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g) || [];
        console.log(`Found ${scripts.length} script tags.`);
        scripts.forEach((s, idx) => {
          if (s.includes('player') || s.includes('file') || s.includes('configs') || s.includes('alloha') || s.includes('vorf')) {
            console.log(`Script ${idx} (snippet of first 200 chars):`, s.slice(0, 200));
          }
        });
        
        break; // Found working referer, stop
      }
    } catch (e) {
      console.log("Fetch error:", e.message);
    }
  }
}

run();
