import fetch from 'node-fetch';

async function run() {
  const host = "larkin-as.stravers.live";
  const url = `https://${host}/build/app.1216f2e9.js`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://stravers.live/'
      }
    });
    if (res.ok) {
      const js = await res.text();
      
      const idxLists = js.indexOf('/lists.php');
      if (idxLists !== -1) {
        console.log("=== Extraction around /lists.php ===");
        // Let's print 4000 characters around lists.php
        console.log(js.slice(Math.max(0, idxLists - 2000), idxLists + 2000));
      }

      const idxVorf = js.indexOf('/vorf');
      if (idxVorf !== -1) {
        console.log("\n=== Extraction around /vorf ===");
        // Let's print 4000 characters around /vorf
        console.log(js.slice(Math.max(0, idxVorf - 2000), idxVorf + 2000));
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

run();
