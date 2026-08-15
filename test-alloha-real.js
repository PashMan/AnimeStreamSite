import fetch from 'node-fetch';

async function testRealAlloha() {
  const shikimoriId = "32281"; // Your Name
  // Let's search if alloha embed can be fetched
  const url = `https://alloha.tv/embed/shikimori/${shikimoriId}`;
  console.log("Fetching:", url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
      }
    });
    console.log("Status:", res.status);
    console.log("Headers:", [...res.headers.entries()]);
    const text = await res.text();
    console.log("Text length:", text.length);
    console.log("First 1000 chars of HTML:");
    console.log(text.slice(0, 1000));
    
    // Check if it contains redirects, script with token_movie, etc.
    const iframeMatch = text.match(/iframe\s+src=["']([\s\S]*?)["']/);
    if (iframeMatch) {
      console.log("Found nested iframe inside embed:", iframeMatch[1]);
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

testRealAlloha();
