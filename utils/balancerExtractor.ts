// Shared Balancer Extractor Helper for Server and Cloudflare Functions
import { decryptStreamUrl, extractStreamsFromPayload, unpackDeanEdwards } from './streamDecryptor';

export { unpackDeanEdwards };

export async function extractBalancersM3u8(iframeUrl: string): Promise<{ m3u8Url: string | null; headers?: Record<string, string>; logs: string[]; htmlLength: number }> {
  const logs: string[] = [];
  logs.push(`[1] Starting extraction for URL: ${iframeUrl}`);

  try {
    let targetUrl = iframeUrl;
    if (targetUrl.startsWith('//')) targetUrl = `https:${targetUrl}`;

    if (targetUrl.includes('.m3u8') || targetUrl.includes('/playlist?url=')) {
      logs.push(`[1.1] URL is already a direct/proxied stream: ${targetUrl}`);
      return { m3u8Url: targetUrl, logs, htmlLength: 0 };
    }

    // Try direct string decryption on the iframe URL itself if it contains encoded tokens or parameters
    const directDecrypted = decryptStreamUrl(targetUrl);
    if (directDecrypted && directDecrypted !== targetUrl) {
      logs.push(`[1.2] URL contained directly decryptable stream: ${directDecrypted}`);
      return { m3u8Url: directDecrypted, logs, htmlLength: 0 };
    }

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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch(urlItem, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Referer': ref,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.length > 50) {
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
          logs.push(`[4] Fetch error (${err?.name === 'AbortError' ? 'timeout' : err.message})`);
        }
      }
    }

    if (!html) {
      logs.push(`[INFO] Iframe content is protected/unavailable directly. Passing request to fallback balancer handlers.`);
      return { m3u8Url: null, logs, htmlLength: 0 };
    }

    // Step A: Dean Edwards unpacker & String Decoders
    const unpacked = unpackDeanEdwards(html);
    if (unpacked.length > html.length) {
      logs.push(`[5] Dean Edwards Packer unpacked. Code expanded from ${html.length} to ${unpacked.length} bytes.`);
    } else {
      logs.push(`[5] No packed Dean Edwards code found or unpacked length unchanged.`);
    }

    // Search and fetch external script bundles (Alloha, Collaps, PlayerJS builds)
    let externalScriptContent = '';
    const scriptSrcMatches = html.match(/<script[^>]+src=["']([^"']+)["']/gi) || [];
    for (const tag of scriptSrcMatches.slice(0, 4)) {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        let scriptUrl = srcMatch[1];
        if (scriptUrl.startsWith('//')) scriptUrl = `https:${scriptUrl}`;
        else if (scriptUrl.startsWith('/')) scriptUrl = `https://${host}${scriptUrl}`;
        else if (!scriptUrl.startsWith('http')) scriptUrl = `https://${host}/${scriptUrl}`;

        if (scriptUrl.includes('app.') || scriptUrl.includes('player') || scriptUrl.includes('build') || scriptUrl.includes('collaps') || scriptUrl.includes('alloha')) {
          logs.push(`[5.1] Fetching external player script bundle: ${scriptUrl}`);
          try {
            const scriptRes = await fetch(scriptUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': targetUrl
              },
              signal: AbortSignal.timeout(3000)
            });
            if (scriptRes.ok) {
              const scriptText = await scriptRes.text();
              logs.push(`[5.2] Loaded ${scriptText.length} bytes from script bundle.`);
              externalScriptContent += '\n' + scriptText + '\n' + unpackDeanEdwards(scriptText);
            }
          } catch (_) {}
        }
      }
    }

    // Unescape Hex (\x..) and Unicode (\u..) sequences in HTML
    let unescapedHtml = '';
    try {
      unescapedHtml = (html + '\n' + externalScriptContent)
        .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } catch (_) {}

    const fullText = html + '\n' + unpacked + '\n' + externalScriptContent + '\n' + unescapedHtml;

    // Step B: Use universal Decryption & Stream Extraction Engine
    logs.push(`[6] Executing multi-algorithm decryption engine for ${host}...`);
    const payloadResult = extractStreamsFromPayload(fullText);
    if (payloadResult.logs && payloadResult.logs.length > 0) {
      logs.push(...payloadResult.logs);
    }

    if (payloadResult.m3u8Url) {
      logs.push(`[7] Successfully decrypted stream using universal engine: ${payloadResult.m3u8Url}`);
      return {
        m3u8Url: payloadResult.m3u8Url,
        headers: {
          'Referer': targetUrl,
          'Origin': `https://${host}`
        },
        logs,
        htmlLength: fullText.length
      };
    }

    // Step C: Base64, ROT & Reversed Decodings
    logs.push(`[8] Deep scanning Base64, Reversed-Base64 & Hex strings...`);
    const b64Regex = /([A-Za-z0-9+/=]{16,})/g;
    let match: RegExpExecArray | null;
    while ((match = b64Regex.exec(fullText)) !== null) {
      const b64Str = match[1];
      const decrypted = decryptStreamUrl(b64Str);
      if (decrypted) {
        logs.push(`[9] Decoded obfuscated string! Found stream: ${decrypted}`);
        return {
          m3u8Url: decrypted,
          headers: {
            'Referer': targetUrl,
            'Origin': `https://${host}`
          },
          logs,
          htmlLength: fullText.length
        };
      }
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

    const configMatches = fullText.match(/(?:makePlayer|Playerjs|playerConfig|window\.collapsConfig|window\.allohaConfig|initPlayer|initCollaps|setPlayer)\s*\(\s*({[\s\S]*?})\s*\)/g) ||
                          fullText.match(/file\s*:\s*["']([\s\S]*?)["']/g) ||
                          fullText.match(/playlist\s*:\s*["']([\s\S]*?)["']/g) ||
                          fullText.match(/manifest\s*:\s*["']([\s\S]*?)["']/g) ||
                          fullText.match(/src\s*:\s*["']([\s\S]*?\.m3u8[^"']*)["']/g);

    if (configMatches) {
      logs.push(`[11] Found ${configMatches.length} candidate player config blocks.`);
      for (const block of configMatches) {
        // Direct stream search in config block
        const directBlockMatch = block.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                                 block.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                                 block.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/);
        if (directBlockMatch) {
          let candidate = directBlockMatch[1].replace(/\\/g, '');
          if (candidate.startsWith('//')) candidate = `https:${candidate}`;
          logs.push(`[12] Found direct .m3u8 inside player config block: ${candidate}`);
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

        const b64s = block.match(/aHR0c[A-Za-z0-9+/=]+/g) || block.match(/[A-Za-z0-9+/=]{16,}/g) || [];
        for (const b of b64s) {
          try {
            const dec = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('utf-8');
            if (dec.includes('.m3u8') || dec.includes('vkvideo.cloud') || dec.includes('manifest') || dec.includes('http')) {
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

              // If token was returned, test /lists.php with verified token
              if (vorfData.token) {
                const authToken = vorfData.token;
                try {
                  const listsRes = await fetch(`https://${host}/lists.php`, {
                    method: 'POST',
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Referer': targetUrl,
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'X-Forwarded-For': '185.220.101.5',
                      'X-Real-IP': '185.220.101.5'
                    },
                    body: new URLSearchParams({ token: authToken }).toString(),
                    signal: AbortSignal.timeout(3000)
                  });
                  if (listsRes.ok) {
                    const listText = await listsRes.text();
                    const streamMatch = listText.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
                                        listText.match(/(https?:\/\/[^"'\s\\]+vkvideo\.cloud[^"'\s\\]+)/);
                    if (streamMatch) {
                      const streamUrl = streamMatch[1].replace(/\\/g, '');
                      logs.push(`[15] Found stream URL in /lists.php response: ${streamUrl}`);
                      return {
                        m3u8Url: streamUrl,
                        headers: {
                          'Authorizations': `Bearer ${authToken}`,
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
