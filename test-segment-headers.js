import fetch from 'node-fetch';

async function run() {
  console.log("=== Testing if CDN segments require custom headers ===");
  
  // We'll try to find a real anime ID from Shiki or similar, or just test fetching from known CDN patterns
  // Let's call our local server API if it's running, or we can fetch a test stream.
  // Wait, let's fetch an Alloha stream if we can find one.
  const host = "larkin-as.stravers.live";
  const targetUrl = `https://${host}/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1`;

  try {
    const vorfRes = await fetch(`https://${host}/vorf`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Referer': targetUrl,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Forwarded-For': '185.220.101.5',
        'X-Real-IP': '185.220.101.5'
      },
      body: 'token=d317441359e505c343c2063edc97e7&token_movie=9c40cb0e1e9af056f56de910be1ec1'
    });

    const vorfData = await vorfRes.json();
    console.log("Vorf response:", vorfData);
    
    if (vorfData.file) {
      const playlistUrl = vorfData.file;
      console.log("Playlist URL:", playlistUrl);
      
      // Fetch playlist
      const playRes = await fetch(playlistUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': targetUrl,
          'Authorizations': `Bearer ${vorfData.token}`
        }
      });
      
      if (playRes.ok) {
        const playText = await playRes.text();
        console.log("Playlist content preview:", playText.slice(0, 300));
        
        // Find first segment
        const lines = playText.split('\n');
        const firstSegment = lines.find(l => l.trim() && !l.startsWith('#'));
        if (firstSegment) {
          const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
          const segmentUrl = firstSegment.startsWith('http') ? firstSegment : baseUrl + firstSegment;
          console.log("Segment URL:", segmentUrl);
          
          // Test fetch 1: with Referer
          const t1 = await fetch(segmentUrl, {
            headers: { 'Referer': targetUrl, 'User-Agent': 'Mozilla/5.0' }
          });
          console.log(`With Referer: Status = ${t1.status}, Length = ${t1.headers.get('content-length')}`);
          
          // Test fetch 2: completely WITHOUT Referer or Origin
          const t2 = await fetch(segmentUrl);
          console.log(`Without any headers: Status = ${t2.status}, Length = ${t2.headers.get('content-length')}`);
        }
      }
    } else {
      console.log("Alloha session expired or tokens invalid, but we can try other ways.");
    }
  } catch (e) {
    console.log("Error during test:", e.message);
  }
}

run();
