// Client-side HLS Stream Extractor & Unpacker for Balancers (Collaps, Alloha, Kodik, Playerjs)

export interface ExtractionResult {
  m3u8Url: string | null;
  logs: string[];
  source: 'client-fetch' | 'client-postmessage' | 'server-debug' | 'none';
}

// Client-side Dean Edwards Packer unpacker
export function unpackDeanEdwardsClient(code: string): string {
  try {
    const regex = /eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/g;
    let result = code;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      let [_, p, aStr, cStr, kStr] = match;
      let a = parseInt(aStr, 10);
      let c = parseInt(cStr, 10);
      let k = kStr.split('|');
      const e = (c: number): string =>
        (c < a ? '' : e(Math.floor(c / a))) +
        (c % a > 35 ? String.fromCharCode((c % a) + 29) : (c % a).toString(36));
      while (c--) {
        if (k[c]) {
          p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
        }
      }
      result += '\n/* UNPACKED DEAN EDWARDS PACKER */\n' + p;
    }
    return result;
  } catch {
    return code;
  }
}

// Client-side parser for HTML/JS text
export function parseTextForM3u8(fullText: string): { m3u8Url: string | null; logs: string[] } {
  const logs: string[] = [];

  // Step 1: Direct .m3u8 URLs
  const directMatches =
    fullText.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g) ||
    fullText.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g);
  if (directMatches && directMatches.length > 0) {
    let candidate = directMatches[0].replace(/\\/g, '');
    if (candidate.startsWith('//')) candidate = `https:${candidate}`;
    logs.push(`[CLIENT] Найден прямой .m3u8 поток в тексте: ${candidate}`);
    return { m3u8Url: candidate, logs };
  }

  // Step 2: Base64 decoding
  logs.push(`[CLIENT] Сканирование Base64 подстрок...`);
  const b64Regex = /([A-Za-z0-9+/=]{24,})/g;
  let match: RegExpExecArray | null;
  while ((match = b64Regex.exec(fullText)) !== null) {
    const b64Str = match[1];
    try {
      const decoded = atob(b64Str);
      if (decoded.includes('.m3u8')) {
        let foundUrl =
          decoded.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
          decoded.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
        if (foundUrl) {
          let candidate = foundUrl[1].replace(/\\/g, '');
          if (candidate.startsWith('//')) candidate = `https:${candidate}`;
          logs.push(`[CLIENT] Расшифрован Base64 блок! Найден .m3u8: ${candidate}`);
          return { m3u8Url: candidate, logs };
        }
      }
    } catch (_) {}
  }

  // Step 3: Playerjs / makePlayer configs
  logs.push(`[CLIENT] Поиск блоков конфигураций Playerjs / makePlayer...`);
  const configMatches =
    fullText.match(/(?:makePlayer|Playerjs|playerConfig|window\.collapsConfig|window\.allohaConfig|initPlayer)\s*\(\s*({[\s\S]*?})\s*\)/g) ||
    fullText.match(/file\s*:\s*["']([\s\S]*?)["']/g);

  if (configMatches) {
    for (const block of configMatches) {
      const b64s = block.match(/aHR0c[A-Za-z0-9+/=]+/g) || block.match(/[A-Za-z0-9+/=]{20,}/g) || [];
      for (const b of b64s) {
        try {
          const dec = atob(b);
          if (dec.includes('.m3u8')) {
            let foundUrl =
              dec.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/) ||
              dec.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
            if (foundUrl) {
              let candidate = foundUrl[1].replace(/\\/g, '');
              if (candidate.startsWith('//')) candidate = `https:${candidate}`;
              logs.push(`[CLIENT] Найдено в конфигурационном файле плеера: ${candidate}`);
              return { m3u8Url: candidate, logs };
            }
          }
        } catch (_) {}
      }
    }
  }

  return { m3u8Url: null, logs };
}

// Main execution routine
export async function runClientExtraction(iframeUrl: string): Promise<ExtractionResult> {
  const logs: string[] = [];
  logs.push(`[1] Запуск клиентской распаковки для URL: ${iframeUrl}`);

  let absoluteUrl = iframeUrl;
  if (absoluteUrl.startsWith('//')) absoluteUrl = `https:${absoluteUrl}`;

  // Attempt 1: Direct Client Fetch
  logs.push(`[2] Попытка прямого клиентского fetch (из браузера)...`);
  try {
    const res = await fetch(absoluteUrl, {
      referrerPolicy: 'no-referrer',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (res.ok) {
      const html = await res.text();
      logs.push(`[3] Успешно загружен HTML клиентским запросом (${html.length} байт).`);

      // Unpack Dean Edwards
      const unpacked = unpackDeanEdwardsClient(html);
      if (unpacked.length > html.length) {
        logs.push(`[4] Клиентский Dean Edwards Unpacker распаковал скрипт (${html.length} -> ${unpacked.length} байт).`);
      }

      const fullCode = html + '\n' + unpacked;
      const parsed = parseTextForM3u8(fullCode);
      logs.push(...parsed.logs);

      if (parsed.m3u8Url) {
        logs.push(`[SUCCESS] Клиентская распаковка успешно завершена! Stream URL найден.`);
        return {
          m3u8Url: parsed.m3u8Url,
          logs,
          source: 'client-fetch'
        };
      }
    } else {
      logs.push(`[3] Прямой fetch вернул статус ${res.status} (возможен CORS/403).`);
    }
  } catch (err: any) {
    logs.push(`[3] Прямой клиентский fetch отклонен браузером (CORS restriction): ${err.message}`);
  }

  // Attempt 2: Server Debug Proxy
  logs.push(`[4] Переход к серверному маршруту расшифровки и проксирования...`);
  try {
    const serverRes = await fetch(`/api/media/debug?url=${encodeURIComponent(absoluteUrl)}`);
    if (serverRes.ok) {
      const data = await serverRes.json();
      logs.push(...(data.logs || []));
      if (data.extractedM3u8) {
        logs.push(`[SUCCESS] Серверный декодер успешно извлек HLS поток!`);
        return {
          m3u8Url: data.extractedM3u8,
          logs,
          source: 'server-debug'
        };
      }
    } else {
      logs.push(`[5] Серверный дебаггер вернул статус ${serverRes.status}`);
    }
  } catch (err: any) {
    logs.push(`[5] Ошибка обращения к серверному дебаггеру: ${err.message}`);
  }

  logs.push(`[ERR] Распаковка завершена без обнаружения открытого HLS потока.`);
  return {
    m3u8Url: null,
    logs,
    source: 'none'
  };
}
