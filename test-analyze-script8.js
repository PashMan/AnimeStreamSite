import fetch from 'node-fetch';

async function run() {
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://stravers.live/',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      }
    });
    const html = await res.text();
    
    const scriptRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
    let match;
    let idx = 0;
    let script8Content = '';
    while ((match = scriptRegex.exec(html)) !== null) {
      if (idx === 8) {
        script8Content = match[2];
        break;
      }
      idx++;
    }

    if (script8Content) {
      console.log("Script 8 length:", script8Content.length);
      
      // Let's print out lines containing "token" or "fetch" or "ajax" or "m3u8" or "/vorf"
      const lines = script8Content.split('\n');
      console.log(`Script 8 has ${lines.length} lines.`);
      
      // Let's search for certain words in the lines
      const keywords = ['token', 'vorf', 'lists', 'm3u8', 'ajax', 'post', 'get', 'fetch', 'fileList', 'active', 'url', 'link', 'hls'];
      keywords.forEach(kw => {
        let count = 0;
        lines.forEach(l => {
          if (l.toLowerCase().includes(kw)) {
            count++;
          }
        });
        console.log(`Keyword '${kw}' matches in ${count} lines.`);
      });

      // Let's print the first 2000 chars of Script 8 to understand its general structure
      console.log("\n=== First 2000 chars of Script 8 ===");
      console.log(script8Content.slice(0, 2000));
    } else {
      console.log("Could not extract Script 8 content.");
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
