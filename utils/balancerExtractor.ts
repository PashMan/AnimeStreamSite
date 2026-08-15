// Shared Balancer Extractor Helper for Server and Cloudflare Functions

export function unpackDeanEdwards(code: string): string {
  try {
    const regex = /eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/g;
    let result = code;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      let [_, p, aStr, cStr, kStr] = match;
      let a = parseInt(aStr, 10);
      let c = parseInt(cStr, 10);
      let k = kStr.split('|');
      const e = (c: number): string => (c < a ? '' : e(Math.floor(c / a))) + (c % a > 35 ? String.fromCharCode(c % a + 29) : (c % a).toString(36));
      while (c--) {
        if (k[c]) {
          p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
        }
      }
      result += '\n/* UNPACKED DEAN EDWARDS PACKER */\n' + p;
    }
    return result;
  } catch (_) {
    return code;
  }
}

export async function extractBalancersM3u8(iframeUrl: string): Promise<{ m3u8Url: string | null; headers?: Record<string, string>; logs: string[]; htmlLength: number }> {
  const logs: string[] = [];
  logs.push(`[1] Starting extraction for URL: ${iframeUrl}`);

  try {
    let targetUrl = iframeUrl;
    if (targetUrl.startsWith('//')) targetUrl = `https:${targetUrl}`;
    const parsedUrl = new URL(targetUrl);
    const host = parsedUrl.host;
    logs.push(`[2] Target host identified: ${host}`);

    const referersToTry = [
      `https://${host}/`,
      'https://stravers.live/',
      'https://alloha.tv/',
      'https://alloha.net/',
      'https://apicollaps.cc/',
      'https://kinopoisk.ru/',
      'https://shikimori.one/'
    ];

    let html = '';
    let usedReferer = '';

    const urlsToTry = [targetUrl];
    try {
      const u = new URL(targetUrl);
      if (u.searchParams.has('episode') && (u.searchParams.has('token_movie') || targetUrl.includes('stravers.live') || targetUrl.includes('alloha'))) {
        const cleaned = new URL(targetUrl);
        cleaned.searchParams.delete('episode');
        urlsToTry.push(cleaned.toString());
      }
    } catch (_) {}

    for (const urlItem of urlsToTry) {
      if (html) break;
      for (const ref of referersToTry) {
        logs.push(`[3] Attempting fetch (${urlItem}) with Referer: ${ref}`);
        try {
          const res = await fetch(urlItem, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Referer': ref,
              'X-Forwarded-For': '185.220.101.5',
              'X-Real-IP': '185.220.101.5',
              'Client-IP': '185.220.101.5',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
          });
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.length > 500) {
              html = txt;
              usedReferer = ref;
              logs.push(`[4] Successfully fetched ${html.length} bytes of HTML using Referer: ${ref}`);
              break;
            } else {
              logs.push(`[4] Fetch returned short response (${txt.length} bytes), trying next referer...`);
            }
          } else {
            logs.push(`[4] Fetch returned HTTP status ${res.status}`);
          }
        } catch (err: any) {
          logs.push(`[4] Fetch error: ${err.message}`);
        }
      }
    }

    if (!html) {
      logs.push(`[ERR] Failed to retrieve HTML from iframe URL across all referers.`);
      return { m3u8Url: null, logs, htmlLength: 0 };
    }

    // Step A: Dean Edwards unpacker
    const unpacked = unpackDeanEdwards(html);
    if (unpacked.length > html.length) {
      logs.push(`[5] Dean Edwards Packer unpacked. Code expanded from ${html.length} to ${unpacked.length} bytes.`);
    } else {
      logs.push(`[5] No packed Dean Edwards code found or unpacked length unchanged.`);
    }

    const fullText = html + '\n' + unpacked;

    // Step B: Search for direct .m3u8 or vkvideo.cloud matches
    logs.push(`[6] Scanning for direct .m3u8 or vkvideo.cloud URLs in full script text...`);
    const directMatches = fullText.match(/(https?:\/\/[^"'\s\\]+\.(?:m3u8|vkvideo\.cloud)[^"'\s\\]*)/g) ||
                          fullText.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+\.m3u8[^"'\s\\]*)/g) ||
                          fullText.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g);
    if (directMatches && directMatches.length > 0) {
      let candidate = directMatches[0].replace(/\\/g, '');
      if (candidate.startsWith('//')) candidate = `https:${candidate}`;
      logs.push(`[7] Found direct .m3u8 match: ${candidate}`);
      return { 
        m3u8Url: candidate, 
        headers: {
          'Referer': targetUrl,
          'Origin': `https://${host}`
        },
        logs, 
        htmlLength: fullText.length 
      };
    }

    // Step C: Base64 Decodings
    logs.push(`[8] Direct .m3u8 not found. Scanning Base64 / Hex strings...`);
    const b64Regex = /([A-Za-z0-9+/=]{24,})/g;
    let match: RegExpExecArray | null;
    while ((match = b64Regex.exec(fullText)) !== null) {
      const b64Str = match[1];
      try {
        const decoded = typeof atob === 'function' ? atob(b64Str) : Buffer.from(b64Str, 'base64').toString('utf-8');
        if (decoded.includes('.m3u8') || decoded.includes('vkvideo.cloud')) {
          let foundUrl = decoded.match(/(https?:\/\/[^"'\s\\]+\.(?:m3u8|vkvideo\.cloud)[^"'\s\\]*)/) ||
                         decoded.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/) ||
                         decoded.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
          if (foundUrl) {
            let candidate = foundUrl[1].replace(/\\/g, '');
            if (candidate.startsWith('//')) candidate = `https:${candidate}`;
            logs.push(`[9] Decoded Base64 string successfully! Found .m3u8: ${candidate}`);
            return { 
              m3u8Url: candidate, 
              headers: {
                'Referer': targetUrl,
                'Origin': `https://${host}`
              },
              logs, 
              htmlLength: fullText.length 
            };
          }
        }
      } catch (_) {}
    }

    // Step D: Alloha fileList & Playerjs / Collaps configs
    logs.push(`[10] Scanning Playerjs / makePlayer / Alloha fileList config blocks...`);

    const fileListMatch = fullText.match(/fileList\s*:\s*JSON\.parse\('([\s\S]*?)'\)/) ||
                          fullText.match(/fileList\s*=\s*JSON\.parse\('([\s\S]*?)'\)/) ||
                          fullText.match(/const\s+fileList\s*=\s*JSON\.parse\('([\s\S]*?)'\)/);
    if (fileListMatch) {
      try {
        const rawJson = fileListMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
        const fileListObj = JSON.parse(rawJson);
        logs.push(`[11] Found Alloha fileList JSON structure! Searching inside JSON...`);
        
        const jsonStringified = JSON.stringify(fileListObj);
        const m3u8InFileList = jsonStringified.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                                jsonStringified.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/) ||
                                jsonStringified.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
        if (m3u8InFileList) {
          let candidate = m3u8InFileList[1].replace(/\\/g, '');
          if (candidate.startsWith('//')) candidate = `https:${candidate}`;
          logs.push(`[12] Found direct .m3u8 inside Alloha fileList JSON: ${candidate}`);
          return { 
            m3u8Url: candidate, 
            headers: {
              'Referer': targetUrl,
              'Origin': `https://${host}`
            },
            logs, 
            htmlLength: fullText.length 
          };
        }

        const b64Matches = jsonStringified.match(/([A-Za-z0-9+/=]{20,})/g) || [];
        for (const b of b64Matches) {
          try {
            const dec = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('utf-8');
            if (dec.includes('.m3u8') || dec.includes('vkvideo.cloud')) {
              let foundUrl = dec.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                             dec.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/) ||
                             dec.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
              if (foundUrl) {
                let candidate = foundUrl[1].replace(/\\/g, '');
                if (candidate.startsWith('//')) candidate = `https:${candidate}`;
                logs.push(`[12] Decoded Base64 in Alloha fileList JSON: ${candidate}`);
                return { 
                  m3u8Url: candidate, 
                  headers: {
                    'Referer': targetUrl,
                    'Origin': `https://${host}`
                  },
                  logs, 
                  htmlLength: fullText.length 
                };
              }
            }
          } catch (_) {}
        }
      } catch (err: any) {
        logs.push(`[11] Error parsing Alloha fileList JSON: ${err.message}`);
      }
    }

    const configMatches = fullText.match(/(?:makePlayer|Playerjs|playerConfig|window\.collapsConfig|window\.allohaConfig|initPlayer)\s*\(\s*({[\s\S]*?})\s*\)/g) ||
                          fullText.match(/file\s*:\s*["']([\s\S]*?)["']/g);

    if (configMatches) {
      logs.push(`[11] Found ${configMatches.length} candidate player config blocks.`);
      for (const block of configMatches) {
        const b64s = block.match(/aHR0c[A-Za-z0-9+/=]+/g) || block.match(/[A-Za-z0-9+/=]{20,}/g) || [];
        for (const b of b64s) {
          try {
            const dec = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('utf-8');
            if (dec.includes('.m3u8') || dec.includes('vkvideo.cloud')) {
              let foundUrl = dec.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                             dec.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/) ||
                             dec.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
              if (foundUrl) {
                let candidate = foundUrl[1].replace(/\\/g, '');
                if (candidate.startsWith('//')) candidate = `https:${candidate}`;
                logs.push(`[12] Found .m3u8 inside player config block Base64: ${candidate}`);
                return { 
                  m3u8Url: candidate, 
                  headers: {
                    'Referer': targetUrl,
                    'Origin': `https://${host}`
                  },
                  logs, 
                  htmlLength: fullText.length 
                };
              }
            }
          } catch (_) {}
        }
      }
    }

    // Step E: Check /vorf token for Alloha if present
    if (host.includes('stravers.live') || host.includes('alloha')) {
      logs.push(`[13] Checking Alloha /vorf token verification API...`);
      try {
        const tokenMatch = targetUrl.match(/token=([a-f0-9]+)/);
        const tokenMovieMatch = targetUrl.match(/token_movie=([a-f0-9]+)/);
        if (tokenMatch && tokenMovieMatch) {
          const vorfRes = await fetch(`https://${host}/vorf`, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': targetUrl,
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Forwarded-For': '185.220.101.5',
              'X-Real-IP': '185.220.101.5'
            },
            body: new URLSearchParams({
              token: tokenMatch[1],
              token_movie: tokenMovieMatch[1]
            }).toString()
          });
          if (vorfRes.ok) {
            const vorfData = await vorfRes.json() as any;
            if (vorfData && vorfData.ok) {
              logs.push(`[14] Successfully obtained Alloha /vorf verification response.`);
              if (vorfData.file || vorfData.url || vorfData.playlist) {
                const streamUrl = vorfData.file || vorfData.url || vorfData.playlist;
                logs.push(`[15] Found stream URL in /vorf response: ${streamUrl}`);
                return {
                  m3u8Url: streamUrl,
                  headers: {
                    'Authorizations': vorfData.token ? `Bearer ${vorfData.token}` : '',
                    'Referer': targetUrl,
                    'Origin': `https://${host}`
                  },
                  logs,
                  htmlLength: fullText.length
                };
              }
            }
          }
        }
      } catch (e: any) {
        logs.push(`[13] Alloha /vorf request failed: ${e.message}`);
      }
    }

    logs.push(`[ERR] Extraction completed without finding a direct .m3u8 stream.`);
    return { m3u8Url: null, logs, htmlLength: fullText.length };

  } catch (err: any) {
    logs.push(`[FATAL] Extraction threw exception: ${err.message}`);
    return { m3u8Url: null, logs, htmlLength: 0 };
  }
}
