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
    
    // Let's find all script tags
    const scriptRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
    let match;
    let idx = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const scriptBody = match[2];
      console.log(`\n--- Script ${idx} (Attr: ${match[1].trim()}) ---`);
      if (scriptBody.length < 500) {
        console.log(scriptBody);
      } else {
        console.log(`Body too long (${scriptBody.length} chars). First 300:`);
        console.log(scriptBody.slice(0, 300));
        console.log("...");
        console.log("Last 300:");
        console.log(scriptBody.slice(-300));
      }
      idx++;
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
