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
    
    // Find Script 8 or the "const config =" script tag
    const scriptRegex = /const\s+config\s*=\s*JSON\.parse\('([\s\S]*?)'\);/m;
    const match = html.match(scriptRegex);
    if (match) {
      console.log("Matched config!");
      const rawJson = match[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      const configObj = JSON.parse(rawJson);
      console.log("Config keys:", Object.keys(configObj));
      console.log("Config content:", JSON.stringify(configObj, null, 2).slice(0, 3000));
    } else {
      console.log("Could not match 'const config =' using standard regex. Let's look for any config match.");
      const genericConfigRegex = /config\s*=\s*JSON\.parse\('([\s\S]*?)'\)/;
      const match2 = html.match(genericConfigRegex);
      if (match2) {
        console.log("Matched config with second regex!");
        const rawJson = match2[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
        const configObj = JSON.parse(rawJson);
        console.log("Config content:", JSON.stringify(configObj, null, 2).slice(0, 3000));
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
