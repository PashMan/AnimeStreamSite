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

  // Use same-origin server decoder endpoint (/api/media/debug)
  logs.push(`[2] Обращение к защищенному серверному декодеру (/api/media/debug)...`);
  try {
    const debugUrl = `/api/media/debug?url=${encodeURIComponent(absoluteUrl)}`;
    const serverRes = await fetch(debugUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const contentType = serverRes.headers.get('content-type') || '';
    if (serverRes.ok && contentType.includes('application/json')) {
      const data = await serverRes.json();
      logs.push(...(data.logs || []));
      if (data.extractedM3u8) {
        logs.push(`[SUCCESS] Декодер успешно извлек HLS поток!`);
        return {
          m3u8Url: data.extractedM3u8,
          logs,
          source: 'server-debug'
        };
      }
    } else {
      const errText = await serverRes.text();
      logs.push(`[3] Серверный дебаггер вернул статус ${serverRes.status}: ${errText.slice(0, 150)}`);
    }
  } catch (err: any) {
    logs.push(`[3] Ошибка обращения к декодеру: ${err.message}`);
  }

  logs.push(`[INFO] Прямой текстовый .m3u8 не найден. Переключение на динамический прокси-маршрут балансера.`);
  return {
    m3u8Url: null,
    logs,
    source: 'none'
  };
}

export interface CascadingExtractionResult {
  m3u8Url: string | null;
  activePlayerName: string | null;
  activeIframeUrl: string | null;
  logs: string[];
}

// Cascading multi-balancer stream extractor: Alloha ➔ Collaps ➔ Kodik
export async function runClientCascadingExtraction(
  players: { name: string; iframe: string }[],
  selectedPlayerName?: string,
  paramEpisode?: string
): Promise<CascadingExtractionResult> {
  const aggregatedLogs: string[] = [];
  aggregatedLogs.push(`[CASCADE] Запуск каскадного поиска HLS потока (Приоритет: Alloha ➔ Collaps ➔ Kodik)...`);

  const priorityOrder = ['Alloha', 'Collaps', 'Kodik'];
  const candidates: { name: string; iframe: string }[] = [];

  // If user selected a specific non-4K/1080p generic player name, prioritize it first
  if (selectedPlayerName && selectedPlayerName !== 'KamiPlayer (4K UHD)' && selectedPlayerName !== 'KamiPlayer (1080p)') {
    const userSel = players.find(p => p.name === selectedPlayerName && p.iframe);
    if (userSel) candidates.push(userSel);
  }

  // Add priority order strictly: Alloha, Collaps, Kodik
  for (const prio of priorityOrder) {
    const found = players.find(p => p.name === prio && p.iframe);
    if (found && !candidates.some(c => c.name === found.name)) {
      candidates.push(found);
    }
  }

  if (candidates.length === 0) {
    aggregatedLogs.push(`[CASCADE ⚠️] Нет доступных плееров с iframe ссылками.`);
    return { m3u8Url: null, activePlayerName: null, activeIframeUrl: null, logs: aggregatedLogs };
  }

  for (const candidate of candidates) {
    aggregatedLogs.push(`\n========================================`);
    aggregatedLogs.push(`[CASCADE ➔] Проверка источника: ${candidate.name}`);

    let targetIframe = candidate.iframe;
    if (paramEpisode) {
      try {
        const u = new URL(targetIframe.startsWith('//') ? `https:${targetIframe}` : targetIframe);
        u.searchParams.set('episode', paramEpisode);
        targetIframe = u.toString();
      } catch (_) {}
    }

    const isKodikOrAni = candidate.name === 'Kodik' || candidate.name === 'AniLibria' || targetIframe.includes('kodik') || targetIframe.includes('anilibria');

    let finalM3u8: string | null = null;

    if (isKodikOrAni) {
      finalM3u8 = `/api/media/playlist?url=${encodeURIComponent(targetIframe)}`;
      aggregatedLogs.push(`[CASCADE 🔄] Задействован декодер серверного плейлиста для ${candidate.name}: ${finalM3u8}`);
    } else {
      const res = await runClientExtraction(targetIframe);
      aggregatedLogs.push(...res.logs);

      if (res.m3u8Url) {
        finalM3u8 = res.m3u8Url.startsWith('/api/') ? res.m3u8Url : `/api/media/playlist?url=${encodeURIComponent(res.m3u8Url)}`;
        aggregatedLogs.push(`[CASCADE 🎯] Извлечен прямой HLS поток: ${finalM3u8}`);
      } else {
        finalM3u8 = `/api/media/playlist?url=${encodeURIComponent(targetIframe)}`;
        aggregatedLogs.push(`[CASCADE 🔄] Задействован прокси балансера для ${candidate.name}: ${finalM3u8}`);
      }
    }

    if (finalM3u8) {
      aggregatedLogs.push(`\n[CASCADE SUCCESS 🎉] Успех! Активный источник HLS потока: ${candidate.name}`);
      return {
        m3u8Url: finalM3u8,
        activePlayerName: candidate.name,
        activeIframeUrl: targetIframe,
        logs: aggregatedLogs
      };
    } else {
      aggregatedLogs.push(`[CASCADE ⚠️] Источник ${candidate.name} недоступен. Переход к следующему источнику в цепочке...`);
    }
  }

  aggregatedLogs.push(`\n[CASCADE ERR] Ни один из источников (${candidates.map(c => c.name).join(', ')}) не содержит доступный HLS поток.`);
  return {
    m3u8Url: null,
    activePlayerName: null,
    activeIframeUrl: null,
    logs: aggregatedLogs
  };
}
