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
      const lines = script8Content.split('\n');
      console.log("Lines length:", lines.length);
      lines.forEach((l, i) => {
        console.log(`\n=== Line ${i} (Length: ${l.length}) ===`);
        console.log(l.slice(0, 1000));
        if (l.length > 1000) {
          console.log("...");
          console.log(l.slice(-1000));
        }
      });
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
