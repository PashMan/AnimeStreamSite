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
    
    // Look for any string ending in .m3u8 (even partial or escaped)
    const m3u8Regex = /[a-zA-Z0-9_/.-]+\.m3u8/g;
    const m3u8Matches = html.match(m3u8Regex) || [];
    console.log("Found .m3u8 occurrences:", [...new Set(m3u8Matches)]);

    // Look for any AJAX fetch or jQuery post/get
    const ajaxMatches = html.match(/\$\.(?:ajax|post|get)\([\s\S]*?\)/g) || [];
    console.log(`Found ${ajaxMatches.length} $.ajax/post/get calls.`);
    
    // Look for fetch
    const fetchMatches = html.match(/fetch\([\s\S]*?\)/g) || [];
    console.log(`Found ${fetchMatches.length} fetch() calls.`);
    
    // Look for WebSocket
    const wsMatches = html.match(/WebSocket/g) || [];
    console.log(`Found ${wsMatches.length} WebSocket occurrences.`);
    
    // Look for any JSON.parse
    const jsonMatches = html.match(/JSON\.parse\([\s\S]*?\)/g) || [];
    console.log(`Found ${jsonMatches.length} JSON.parse calls.`);
    jsonMatches.forEach((m, i) => {
      console.log(`JSON.parse ${i}: ${m.slice(0, 150)}...`);
    });

  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
