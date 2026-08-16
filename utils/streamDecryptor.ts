/**
 * Universal Decryption and Decoding Engine for Alloha, Collaps, Kodik and Balancer streams.
 * Handles Multi-layer Base64, ROT-N, Reversed-Base64, PlayerJS XOR/#2 prefixes, 
 * Dean Edwards P.A.C.K.E.R, Hex/Unicode escapes, and multi-quality stream lists.
 */

// Helper to check if a string is a valid media/stream URL
export function isValidStreamUrl(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return (
    s.includes('.m3u8') ||
    s.includes('mp4:hls:manifest') ||
    s.includes('/manifest') ||
    s.includes('/playlist') ||
    s.includes('cloud.kodik') ||
    s.includes('vkvideo.cloud') ||
    s.includes('ortified.ws') ||
    s.includes('stravers.live') ||
    s.includes('aniqit.com') ||
    s.includes('vazha.net') ||
    ((s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//')) && (s.includes('.mp4') || s.includes('.m3u8')))
  );
}

// Convert character by Caesar ROT shift
export function convertChar(char: string, num: number): string {
  const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const upper = char.toUpperCase();
  if (alph.includes(upper)) {
    const idx = (alph.indexOf(upper) + num) % alph.length;
    const ch = alph[idx];
    return char === char.toLowerCase() ? ch.toLowerCase() : ch;
  }
  return char;
}

// Safe Base64 decoding supporting standard and URL-safe Base64
export function safeAtob(str: string): string | null {
  if (!str || typeof str !== 'string') return null;
  try {
    let clean = str.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (clean.length % 4)) % 4;
    clean = clean + '='.repeat(pad);
    
    if (typeof atob === 'function') {
      return atob(clean);
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64').toString('utf-8');
    }
  } catch (_) {}
  return null;
}

// Playerjs / Balancer #2 and #!~ string decoders
export function decodePlayerJsString(str: string): string | null {
  if (!str || typeof str !== 'string') return null;
  let s = str.trim();

  // Pattern: #2 (Reversed / Base64 variant)
  if (s.startsWith('#2')) {
    s = s.substring(2);
    const decoded = safeAtob(s);
    if (decoded && isValidStreamUrl(decoded)) return decoded;
    // Try reverse
    const revDecoded = safeAtob(s.split('').reverse().join(''));
    if (revDecoded && isValidStreamUrl(revDecoded)) return revDecoded;
  }

  // Pattern: #!~ (Playerjs custom XOR / char shift)
  if (s.startsWith('#!~') || s.startsWith('~')) {
    const raw = s.replace(/^#!~|~/, '');
    // Try base64 of raw
    const b64 = safeAtob(raw);
    if (b64 && isValidStreamUrl(b64)) return b64;

    // Try char code shift
    for (let offset = -10; offset <= 10; offset++) {
      if (offset === 0) continue;
      try {
        let shifted = '';
        for (let i = 0; i < raw.length; i++) {
          shifted += String.fromCharCode(raw.charCodeAt(i) + offset);
        }
        if (isValidStreamUrl(shifted)) return shifted;
        const b64Shifted = safeAtob(shifted);
        if (b64Shifted && isValidStreamUrl(b64Shifted)) return b64Shifted;
      } catch (_) {}
    }
  }

  // Pattern: Double slash or prefix encoded
  if (s.startsWith('//') && (s.includes('.m3u8') || s.includes('vkvideo.cloud'))) {
    return `https:${s}`;
  }

  return null;
}

// Multi-quality parse: e.g. "[1080p]https://...m3u8,[720p]https://...m3u8" or single URL
export function parseQualitySources(qualityString: string, preferredQuality?: string | number): { quality: string; url: string }[] {
  if (!qualityString) return [];
  const results: { quality: string; url: string }[] = [];

  // Match e.g. [1080p]https://... or [720p]https://... or or_1080: "..."
  const regex = /\[(\d+p?|4K|HD|SD|Auto)\]([^,\[\]]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(qualityString)) !== null) {
    let q = match[1].replace(/p/i, '');
    let u = match[2].trim();
    if (u.startsWith('//')) u = `https:${u}`;
    results.push({ quality: q, url: u });
  }

  if (results.length === 0) {
    // Check if it's a comma-separated list of raw URLs or single URL
    const parts = qualityString.split(',');
    for (const part of parts) {
      let trimmed = part.trim();
      if (isValidStreamUrl(trimmed)) {
        if (trimmed.startsWith('//')) trimmed = `https:${trimmed}`;
        // Extract quality hint if present in filename or query (e.g. 1080.m3u8, 720.mp4)
        const qMatch = trimmed.match(/(\d{3,4})p?(?:\.m3u8|\.mp4|\/index)/i);
        const q = qMatch ? qMatch[1] : '1080';
        results.push({ quality: q, url: trimmed });
      }
    }
  }

  return results;
}

// Select best stream URL from parsed list
export function selectBestStreamUrl(sources: { quality: string; url: string }[], preferredQuality?: string | number): string | null {
  if (!sources || sources.length === 0) return null;

  if (preferredQuality) {
    const prefStr = String(preferredQuality).replace(/p/i, '');
    const matched = sources.find(s => s.quality.toLowerCase() === prefStr.toLowerCase());
    if (matched) return matched.url;
  }

  // Sort descending by quality (1080, 720, 480, 360)
  const sorted = [...sources].sort((a, b) => {
    const numA = parseInt(a.quality) || 0;
    const numB = parseInt(b.quality) || 0;
    return numB - numA;
  });

  return sorted[0].url;
}

// Specialized Kodik stream decryption routine
export function decodeKodikUrl(encoded: string, rotNum?: number): string {
  if (!encoded) return '';
  if (encoded.startsWith('http://') || encoded.startsWith('https://') || encoded.startsWith('//')) {
    return encoded.startsWith('//') ? `https:${encoded}` : encoded;
  }

  // 1. Direct Base64 attempt
  const directB64 = safeAtob(encoded);
  if (directB64 && isValidStreamUrl(directB64)) return directB64;

  // 2. Reversed Base64 attempt
  const rev = encoded.split('').reverse().join('');
  const revB64 = safeAtob(rev);
  if (revB64 && isValidStreamUrl(revB64)) return revB64;

  // 3. Specified ROT-N
  if (rotNum !== undefined) {
    const crypted = encoded.split('').map(c => convertChar(c, rotNum)).join('');
    const decoded = safeAtob(crypted);
    if (decoded && isValidStreamUrl(decoded)) return decoded;
  }

  // 4. Brute-force all 26 ROT variations
  for (let rot = 0; rot < 26; rot++) {
    const crypted = encoded.split('').map(c => convertChar(c, rot)).join('');
    const decoded = safeAtob(crypted);
    if (decoded && isValidStreamUrl(decoded)) return decoded;
  }

  // 5. Brute-force all 26 ROT variations on reversed string
  for (let rot = 0; rot < 26; rot++) {
    const crypted = rev.split('').map(c => convertChar(c, rot)).join('');
    const decoded = safeAtob(crypted);
    if (decoded && isValidStreamUrl(decoded)) return decoded;
  }

  // If already contains manifest/m3u8 pattern
  if (isValidStreamUrl(encoded)) {
    return encoded.startsWith('//') ? `https:${encoded}` : encoded;
  }

  throw new Error('Decryption of Kodik stream URL failed');
}

// Dean Edwards P.A.C.K.E.R Unpacker
export function unpackDeanEdwards(packedCode: string): string {
  if (!packedCode || !packedCode.includes('eval(function(p,a,c,k,e,d)')) {
    return '';
  }

  try {
    const match = packedCode.match(/eval\(function\(p,a,c,k,e,[rd]\)\s*\{[\s\S]*?\}\s*\(([\s\S]*?)\)\s*\)/);
    if (!match) return '';

    const argsStr = match[1];
    const parseArgsRegex = /'([\s\S]*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/;
    const argsMatch = argsStr.match(parseArgsRegex);
    if (!argsMatch) return '';

    let payload = argsMatch[1];
    const radix = parseInt(argsMatch[2], 10);
    const count = parseInt(argsMatch[3], 10);
    const symtab = argsMatch[4].split('|');

    const unbase = (val: string, r: number): number => {
      const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let res = 0;
      for (let i = 0; i < val.length; i++) {
        res = res * r + alphabet.indexOf(val[i]);
      }
      return res;
    };

    return payload.replace(/\b\w+\b/g, (w) => {
      const idx = unbase(w, radix);
      return idx < count && symtab[idx] ? symtab[idx] : w;
    });
  } catch (_) {
    return '';
  }
}

// Universal deep decryptor for any encoded stream string
export function decryptStreamUrl(input: string, preferredQuality?: string | number): string | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();

  // 1. Direct or protocol-relative URL
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//')) {
    if (s.includes('.m3u8') || s.includes('vkvideo.cloud') || s.includes('/manifest') || s.includes('/playlist')) {
      return s.startsWith('//') ? `https:${s}` : s;
    }
  }

  // 2. Check Playerjs quality formatting [1080p]https://...
  if (s.includes('[') && s.includes(']')) {
    const qualities = parseQualitySources(s, preferredQuality);
    const best = selectBestStreamUrl(qualities, preferredQuality);
    if (best) return best;
  }

  // 3. Check Playerjs #2 / #!~ prefixes
  const playerJsDecoded = decodePlayerJsString(s);
  if (playerJsDecoded) {
    if (playerJsDecoded.includes('[') && playerJsDecoded.includes(']')) {
      const qualities = parseQualitySources(playerJsDecoded, preferredQuality);
      const best = selectBestStreamUrl(qualities, preferredQuality);
      if (best) return best;
    }
    return playerJsDecoded.startsWith('//') ? `https:${playerJsDecoded}` : playerJsDecoded;
  }

  // 4. Try Kodik decryption routine
  try {
    const kodikDecrypted = decodeKodikUrl(s);
    if (kodikDecrypted && isValidStreamUrl(kodikDecrypted)) {
      return kodikDecrypted.startsWith('//') ? `https:${kodikDecrypted}` : kodikDecrypted;
    }
  } catch (_) {}

  // 5. Try Base64 & variations
  const variants = [
    s,
    s.split('').reverse().join(''),
    // ROT13
    s.replace(/[a-zA-Z]/g, c => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(base + (c.charCodeAt(0) - base + 13) % 26);
    })
  ];

  for (const v of variants) {
    const dec = safeAtob(v);
    if (dec) {
      if (isValidStreamUrl(dec)) {
        return dec.startsWith('//') ? `https:${dec}` : dec;
      }
      if (dec.includes('[') && dec.includes(']')) {
        const qualities = parseQualitySources(dec, preferredQuality);
        const best = selectBestStreamUrl(qualities, preferredQuality);
        if (best) return best;
      }
    }
  }

  return null;
}

// Deep extractor from full HTML / JS code for Alloha and Collaps
export function extractStreamsFromPayload(htmlOrJs: string, preferredQuality?: string | number): {
  m3u8Url: string | null;
  qualities: { quality: string; url: string }[];
  logs: string[];
} {
  const logs: string[] = [];
  const foundQualities: { quality: string; url: string }[] = [];

  if (!htmlOrJs) {
    return { m3u8Url: null, qualities: [], logs: ['Empty payload'] };
  }

  // 1. Unpack Dean Edwards if present
  const unpacked = unpackDeanEdwards(htmlOrJs);
  if (unpacked) logs.push(`[DECRYPTOR] Unpacked Dean Edwards packed code (${unpacked.length} chars)`);

  // 2. Unescape Hex & Unicode
  let unescaped = '';
  try {
    unescaped = (htmlOrJs + '\n' + unpacked)
      .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch (_) {}

  const fullText = htmlOrJs + '\n' + unpacked + '\n' + unescaped;

  // 3. Scan for Alloha fileList
  const fileListMatch = fullText.match(/fileList\s*:\s*JSON\.parse\('([\s\S]*?)'\)/) ||
                        fullText.match(/fileList\s*=\s*JSON\.parse\('([\s\S]*?)'\)/);
  if (fileListMatch) {
    try {
      const rawJson = fileListMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      const fileListObj = JSON.parse(rawJson);
      logs.push(`[DECRYPTOR] Parsed Alloha fileList JSON structure`);
      
      const jsonStr = JSON.stringify(fileListObj);
      const m3u8Direct = jsonStr.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g) ||
                         jsonStr.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/g);
      if (m3u8Direct) {
        for (const u of m3u8Direct) {
          const clean = u.replace(/\\/g, '');
          foundQualities.push({ quality: '1080', url: clean });
        }
      }
    } catch (e: any) {
      logs.push(`[DECRYPTOR] Error parsing Alloha fileList JSON: ${e.message}`);
    }
  }

  // 4. Scan for Collaps / PlayerJS file configs
  const configMatches = fullText.match(/file\s*:\s*["']([^"']+)["']/g) ||
                        fullText.match(/playlist\s*:\s*["']([^"']+)["']/g) ||
                        fullText.match(/open\s*:\s*["']([^"']+)["']/g) ||
                        fullText.match(/(?:makePlayer|Playerjs|playerConfig|window\.collapsConfig|window\.allohaConfig)\s*\(\s*({[\s\S]*?})\s*\)/g);
  if (configMatches) {
    for (const match of configMatches) {
      const fileValMatch = match.match(/["']([^"']{10,})["']/);
      if (fileValMatch) {
        const candidate = fileValMatch[1];
        const decrypted = decryptStreamUrl(candidate, preferredQuality);
        if (decrypted) {
          logs.push(`[DECRYPTOR] Decrypted stream config value: ${decrypted.substring(0, 60)}...`);
          foundQualities.push({ quality: '1080', url: decrypted });
        }
      }
    }
  }

  // 5. Scan for direct .m3u8 / vkvideo.cloud occurrences
  const directMatches = fullText.match(/(https?:\/\/[^"'\s\\]+\.(?:m3u8|vkvideo\.cloud)[^"'\s\\]*)/g) ||
                        fullText.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+\.m3u8[^"'\s\\]*)/g) ||
                        fullText.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g);
  if (directMatches) {
    for (const m of directMatches) {
      let clean = m.replace(/\\/g, '');
      if (clean.startsWith('//')) clean = `https:${clean}`;
      foundQualities.push({ quality: '1080', url: clean });
    }
  }

  // 6. Scan Base64 blocks
  const b64Regex = /([A-Za-z0-9+/=]{24,})/g;
  let b64m: RegExpExecArray | null;
  while ((b64m = b64Regex.exec(fullText)) !== null) {
    const dec = decryptStreamUrl(b64m[1], preferredQuality);
    if (dec) {
      logs.push(`[DECRYPTOR] Decoded Base64/Obfuscated stream: ${dec.substring(0, 60)}...`);
      foundQualities.push({ quality: '1080', url: dec });
      break;
    }
  }

  const bestUrl = selectBestStreamUrl(foundQualities, preferredQuality);
  return {
    m3u8Url: bestUrl,
    qualities: foundQualities,
    logs
  };
}
