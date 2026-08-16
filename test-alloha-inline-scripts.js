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
    
    // Extract script tags
    const scriptRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
    let match;
    let idx = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      if (idx === 5 || idx === 6 || idx === 7) {
        console.log(`\n=== SCRIPT ${idx} ===`);
        console.log(match[2]);
      }
      idx++;
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
