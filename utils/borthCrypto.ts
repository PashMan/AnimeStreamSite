// Borth Header Cryptographic Permutation Engine for Alloha / Yani / Stravers Balancers

function generateSessionHash(bytes: number = 32): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const array = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
  let result = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

function getNextPrime(n: number): number {
  let p = Math.max(2, n);
  while (!isPrime(p)) p++;
  return p;
}

// 1. Модульная перестановка по простому числу
function a5(str: string, shiftFlag: any = false): string {
  const len = str.length;
  if (len <= 1) return str;

  const prime = getNextPrime(len + 1);
  const visited = new Array(len).fill(false);
  const indices: number[] = [];
  let current = 0;

  while (indices.length < len) {
    current = (current + 2) % prime;
    if (current < len && !visited[current]) {
      indices.push(current);
      visited[current] = true;
    }
  }

  const resultArr = new Array(len);
  for (let i = 0; i < len; i++) {
    resultArr[indices[i]] = str[i];
  }

  const result = resultArr.join('');
  const shouldShift = Boolean(shiftFlag);
  return (shouldShift && result.length > 1) ? result.slice(1) + result[0] : result;
}

// 2. Битовая перестановка (Count Trailing Zeros)
function a6(str: string, shiftFlag: any = false): string {
  const len = str.length;
  if (len <= 1) return str;

  let bitLen = 1;
  while ((1 << bitLen) < len) bitLen++;

  function getCTZ(n: number): number {
    if (n === 0) return bitLen;
    let count = 0;
    while ((n & 1) === 0) {
      count++;
      n >>= 1;
    }
    return count;
  }

  const counts = new Array(bitLen + 1).fill(0);
  for (let i = 0; i < len; i++) {
    counts[getCTZ(i)]++;
  }

  const buckets = new Array(bitLen + 1);
  let offset = 0;
  for (let i = 0; i <= bitLen; i++) {
    buckets[i] = str.slice(offset, offset + counts[i]);
    offset += counts[i];
  }

  const pointers = new Array(bitLen + 1).fill(0);
  const resultArr = new Array(len);
  for (let i = 0; i < len; i++) {
    const idx = getCTZ(i);
    resultArr[i] = buckets[idx][pointers[idx]++];
  }

  const result = resultArr.join('');
  const shouldShift = Boolean(shiftFlag);
  return (shouldShift && result.length > 1) ? result.slice(1) + result[0] : result;
}

// 3. Битовая перестановка (Most Significant Bit)
function a7(str: string, shiftFlag: any = false): string {
  const len = str.length;
  if (len <= 1) return str;

  let bitLen = 0;
  while ((1 << bitLen) < len) bitLen++;

  function getMSB(n: number): number {
    if (n === 0) return 0;
    let bits = 0;
    while (n > 0) {
      bits++;
      n >>>= 1;
    }
    return bits;
  }

  const counts = new Array(bitLen + 1).fill(0);
  for (let i = 0; i < len; i++) {
    counts[getMSB(i)]++;
  }

  const buckets = new Array(bitLen + 1);
  let offset = 0;
  for (let i = bitLen; i >= 0; i--) {
    buckets[i] = str.slice(offset, offset + counts[i]);
    offset += counts[i];
  }

  const pointers = new Array(bitLen + 1).fill(0);
  const resultArr = new Array(len);
  for (let i = 0; i < len; i++) {
    const idx = getMSB(i);
    resultArr[i] = buckets[idx][pointers[idx]++];
  }

  const result = resultArr.join('');
  const shouldShift = Boolean(shiftFlag);
  return (shouldShift && result.length > 1) ? result.slice(1) + result[0] : result;
}

export function generateBorth(payload: string, sessionHash: string): string {
  const step1 = a7(payload, true);
  const step2 = a6(step1, true);
  const step3 = a5(step2, true);
  return `${sessionHash}|${step3}`;
}

export interface BnsiStreamResult {
  manifestUrl: string | null;
  authorizations?: string;
  acceptsControls?: string;
  referer?: string;
  origin?: string;
  logs: string[];
}

/**
 * Executes a high-level Borth Handshake against Alloha / Yani / Stravers / Pljjalgo balancers
 */
export async function executeAllohaHandshake(params: {
  host: string;
  tokenMovie: string;
  movieId?: string;
  season?: string;
  episode?: string;
  translation?: string;
}): Promise<BnsiStreamResult> {
  const logs: string[] = [];
  const { host, tokenMovie, movieId, season = '1', episode = '1', translation } = params;

  logs.push(`[BORTH] Initiating handshake for host: ${host}, tokenMovie: ${tokenMovie}, episode: ${episode}`);

  const sessionHash = generateSessionHash(32);
  const clientPayload = JSON.stringify({
    ts: Date.now(),
    tz: -180,
    screen: '1920x1080',
    r: Math.random().toString(36).substring(7)
  });

  const borthHeader = generateBorth(clientPayload, sessionHash);
  logs.push(`[BORTH] Generated Borth header: ${borthHeader.slice(0, 32)}...`);

  const hostsToTry = [
    host,
    'larkin-as.stravers.live',
    'beggins-as.pljjalgo.online',
    'alloha.yani.tv',
    'api.alloha.tv'
  ].filter(Boolean);

  const endpointsToTry = [
    movieId ? `/bnsi/movies/${movieId}` : null,
    movieId ? `/bnsi/serials/${movieId}` : null,
    `/bnsi/serials/1`,
    `/bnsi/movies/1`
  ].filter(Boolean) as string[];

  for (const h of hostsToTry) {
    for (const ep of endpointsToTry) {
      const targetEndpointUrl = `https://${h}${ep}`;
      logs.push(`[BORTH] Testing POST ${targetEndpointUrl}...`);

      const postBody: Record<string, string> = {
        token: tokenMovie,
        season,
        episode,
        av1: 'true',
        autoplay: '0'
      };
      if (translation) {
        postBody.translation = translation;
      }

      try {
        const res = await fetch(targetEndpointUrl, {
          method: 'POST',
          headers: {
            'Borth': borthHeader,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Referer': `https://${h}/?token_movie=${tokenMovie}`,
            'Origin': `https://${h}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: new URLSearchParams(postBody).toString(),
          signal: AbortSignal.timeout(4000)
        });

        logs.push(`[BORTH] Response status from ${targetEndpointUrl}: ${res.status}`);

        if (res.ok) {
          const data = await res.json() as any;
          logs.push(`[BORTH] Received JSON: ${JSON.stringify(data).slice(0, 300)}`);

          const manifestUrl = data.playlist_url || data.file || data.manifestUrl || data.url || data.playlist;
          const streamToken = data.session_token || data.token || data.streamToken;
          const acceptsControls = data.accepts_controls || data.key || data.acceptsControls;

          if (manifestUrl) {
            logs.push(`[BORTH] SUCCESS! Extracted stream manifest: ${manifestUrl}`);
            return {
              manifestUrl,
              authorizations: streamToken ? `Bearer ${streamToken}` : undefined,
              acceptsControls,
              referer: `https://${h}/?token_movie=${tokenMovie}`,
              origin: `https://${h}`,
              logs
            };
          }
        }
      } catch (err: any) {
        logs.push(`[BORTH] Error on ${targetEndpointUrl}: ${err.message}`);
      }
    }
  }

  return {
    manifestUrl: null,
    logs
  };
}
