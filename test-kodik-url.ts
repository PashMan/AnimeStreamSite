import { fetchKodikData } from './services/kodik.js';

// ROT function used by Kodik
function convertChar(char: string, num: number): string {
  const alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const upper = char.toUpperCase();
  if (alph.includes(upper)) {
    const idx = (alph.indexOf(upper) + num) % alph.length;
    const ch = alph[idx];
    return char === char.toLowerCase() ? ch.toLowerCase() : ch;
  }
  return char;
}

function decodeKodikUrl(encoded: string, rotNum?: number): string {
  if (rotNum !== undefined) {
    const crypted = encoded.split('').map(c => convertChar(c, rotNum)).join('');
    const padding = (4 - (crypted.length % 4)) % 4;
    try {
      const decoded = atob(crypted + '='.repeat(padding));
      if (decoded.includes('mp4:hls:manifest')) return decoded;
    } catch {}
  }
  for (let rot = 0; rot < 26; rot++) {
    const crypted = encoded.split('').map(c => convertChar(c, rot)).join('');
    const padding = (4 - (crypted.length % 4)) % 4;
    try {
      const decoded = atob(crypted + '='.repeat(padding));
      if (decoded.includes('mp4:hls:manifest')) {
         return decoded;
      }
    } catch {}
  }
  throw new Error('Decryption of Kodik stream URL failed');
}

async function run() {
  console.log("Searching for Suzume (62568) on Kodik...");
  const results = await fetchKodikData('62568');
  if (results.length === 0) {
    console.log("No results found on Kodik for 62568.");
    return;
  }
  
  const anime = results[0];
  console.log(`Found: ${anime.translation.title}, Link: ${anime.link}`);
  
  const iframeUrl = anime.link.startsWith('//') ? `https:${anime.link}` : anime.link;
  const proxiedIframeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(iframeUrl)}`;
  console.log(`Fetching iframe HTML via AllOrigins proxy: ${proxiedIframeUrl}`);
  
  const res = await fetch(proxiedIframeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Referer': 'https://shikimori.one/'
    }
  });
  
  const html = await res.text();
  console.log(`HTML loaded, length: ${html.length}`);
  console.log("HTML content:", html);
  
  const urlParamsMatch = html.match(/urlParams\s*=\s*'([^']+)'/) || html.match(/urlParams\s*=\s*({[^;]+})/);
  const hashMatch = html.match(/\.hash\s*=\s*'([^']+)'/);
  const idMatch = html.match(/\.id\s*=\s*'([^']+)'/);
  const typeMatch = html.match(/\.type\s*=\s*'([^']+)'/);
  
  console.log({
    urlParamsFound: !!urlParamsMatch,
    hashFound: !!hashMatch,
    idFound: !!idMatch,
    typeFound: !!typeMatch
  });
  
  if (!urlParamsMatch || !hashMatch || !idMatch || !typeMatch) {
    return;
  }
  
  const urlParams = JSON.parse(urlParamsMatch[1]);
  const videoHash = hashMatch[1];
  const videoId = idMatch[1];
  const videoType = typeMatch[1];
  
  console.log(`Params parsed. Hash: ${videoHash}, Id: ${videoId}, Type: ${videoType}`);
  
  // Script URL extraction
  const scriptMatches = html.match(/<script\s+src="([^"]+\.js)"/g) || [];
  let scriptUrl = '';
  for (const match of scriptMatches) {
    const srcAttr = match.match(/src="([^"]+)"/);
    if (srcAttr && srcAttr[1] && srcAttr[1].includes('/assets/')) {
      scriptUrl = srcAttr[1];
      break;
    }
  }
  if (!scriptUrl && scriptMatches[1]) {
    const srcAttr = scriptMatches[1].match(/src="([^"]+)"/);
    if (srcAttr) scriptUrl = srcAttr[1];
  }
  if (!scriptUrl) scriptUrl = '/assets/seria.js';
  
  const baseUrlObj = new URL(iframeUrl);
  const scriptAbsoluteUrl = scriptUrl.startsWith('http') ? scriptUrl : `${baseUrlObj.protocol}//${baseUrlObj.host}${scriptUrl}`;
  const proxiedScriptUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(scriptAbsoluteUrl)}`;
  console.log(`Fetching script: ${proxiedScriptUrl}`);
  
  const scriptRes = await fetch(proxiedScriptUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': iframeUrl
    }
  });
  const scriptHtml = await scriptRes.text();
  
  // Find Gbox ajax
  const ajaxMatch = scriptHtml.match(/\$.ajax\(\{[^}]+url:\s*atob\("([^"]+)"\)/) || scriptHtml.match(/atob\("([^"]+)"\)/);
  if (!ajaxMatch) {
    console.log("Could not find Gbox ajax link.");
    return;
  }
  
  const gboxPath = atob(ajaxMatch[1]);
  const gboxUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${gboxPath}`;
  const proxiedGboxUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(gboxUrl)}`;
  console.log(`Gbox Ajax URL via proxy: ${proxiedGboxUrl}`);
  
  const payload = new URLSearchParams({
    hash: videoHash,
    id: videoId,
    type: videoType,
    d: urlParams.d || 'kodik.info',
    d_sign: urlParams.d_sign || '',
    pd: urlParams.pd || '',
    pd_sign: urlParams.pd_sign || '',
    ref: '',
    ref_sign: urlParams.ref_sign || '',
    bad_user: 'true',
    cdn_is_working: 'true'
  });
  
  const gboxRes = await fetch(proxiedGboxUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': iframeUrl
    },
    body: payload.toString()
  });
  
  const gboxData = await gboxRes.json() as any;
  console.log("Gbox Data:", JSON.stringify(gboxData).slice(0, 500));
  
  if (!gboxData || !gboxData.links) {
    console.log("No links returned");
    return;
  }
  
  const qualities = Object.keys(gboxData.links).map(Number).sort((a,b) => b-a);
  console.log(`Found qualities: ${qualities.join(', ')}`);
  
  const bestQual = qualities[0] || '720';
  const sources = gboxData.links[String(bestQual)];
  console.log(`Best Quality: ${bestQual}, Sources:`, sources);
  
  if (!sources || sources.length === 0) return;
  const rawSrc = sources[0].src;
  
  const decryptedUrl = rawSrc.includes('mp4:hls:manifest') ? rawSrc : decodeKodikUrl(rawSrc);
  const playlistUrl = decryptedUrl.startsWith('//') ? `https:${decryptedUrl}` : decryptedUrl;
  const proxiedPlaylistUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(playlistUrl)}`;
  console.log(`Decrypted HLS URL proxied: ${proxiedPlaylistUrl}`);
  
  console.log("Fetching M3U8 content...");
  const m3u8Res = await fetch(proxiedPlaylistUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://kodik.info/'
    }
  });
  
  const m3u8Text = await m3u8Res.text();
  console.log(`M3U8 response (first 300 chars):`);
  console.log(m3u8Text.slice(0, 300));
}

run();
