import fetch from 'node-fetch';

async function inspectScripts() {
  const targetUrl = "https://larkin-as.stravers.live/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1";
  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Referer': 'https://larkin-as.stravers.live/',
      'X-Forwarded-For': '185.220.101.5',
      'X-Real-IP': '185.220.101.5',
      'Client-IP': '185.220.101.5'
    }
  });
  const html = await res.text();
  console.log("HTML length:", html.length);

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let count = 0;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    count++;
    console.log(`=== SCRIPT #${count} ===`);
    console.log(scriptMatch[1]);
  }

  // Also check external script src tags
  const srcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let srcMatch;
  while ((srcMatch = srcRegex.exec(html)) !== null) {
    console.log(`Script src: ${srcMatch[1]}`);
  }
}

inspectScripts();
