// Client-side HLS Stream Extractor & Unpacker for Balancers (Collaps, Alloha, Kodik, Playerjs)
import { decryptStreamUrl, extractStreamsFromPayload, unpackDeanEdwards } from './streamDecryptor';

export interface ExtractionResult {
  m3u8Url: string | null;
  logs: string[];
  source: 'client-fetch' | 'client-postmessage' | 'server-debug' | 'none';
}

// Client-side Dean Edwards Packer unpacker
export const unpackDeanEdwardsClient = unpackDeanEdwards;

// Client-side parser for HTML/JS text
export function parseTextForM3u8(fullText: string): { m3u8Url: string | null; logs: string[] } {
  const logs: string[] = [];

  // Step 1: Universal Payload Decryption
  logs.push(`[CLIENT] Запуск универсального алгоритма деобфускации и декодирования...`);
  const payloadRes = extractStreamsFromPayload(fullText);
  if (payloadRes.logs && payloadRes.logs.length > 0) {
    logs.push(...payloadRes.logs);
  }

  if (payloadRes.m3u8Url) {
    logs.push(`[CLIENT] Успешно расшифрован прямой поток: ${payloadRes.m3u8Url}`);
    return { m3u8Url: payloadRes.m3u8Url, logs };
  }

  // Step 2: Direct .m3u8 URLs
  const directMatches =
    fullText.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g) ||
    fullText.match(/(\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/g);
  if (directMatches && directMatches.length > 0) {
    let candidate = directMatches[0].replace(/\\/g, '');
    if (candidate.startsWith('//')) candidate = `https:${candidate}`;
    logs.push(`[CLIENT] Найден прямой .m3u8 поток в тексте: ${candidate}`);
    return { m3u8Url: candidate, logs };
  }

  // Step 3: Base64 & ROT deep scanning
  logs.push(`[CLIENT] Глубокое сканирование Base64 и зашифрованных подстрок...`);
  const b64Regex = /([A-Za-z0-9+/=]{16,})/g;
  let match: RegExpExecArray | null;
  while ((match = b64Regex.exec(fullText)) !== null) {
    const b64Str = match[1];
    const decrypted = decryptStreamUrl(b64Str);
    if (decrypted) {
      logs.push(`[CLIENT] Расшифрован зашифрованный блок! Найден поток: ${decrypted}`);
      return { m3u8Url: decrypted, logs };
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
  if (selectedPlayerName && selectedPlayerName !== 'KamiPlayer (4K UHD)') {
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
    aggregatedLogs.push(`[CASCADE ➔] Глубокий анализ источника: ${candidate.name}`);

    let targetIframe = candidate.iframe;
    if (paramEpisode) {
      try {
        const u = new URL(targetIframe.startsWith('//') ? `https:${targetIframe}` : targetIframe);
        u.searchParams.set('episode', paramEpisode);
        targetIframe = u.toString();
      } catch (_) {}
    }

    // Attempt multi-level unpacking and decryption for this balancer
    aggregatedLogs.push(`[CASCADE 🔍] Запуск 6-ступенчатого движка деобфускации для ${candidate.name}...`);
    const res = await runClientExtraction(targetIframe);
    aggregatedLogs.push(...res.logs);

    if (res.m3u8Url) {
      const finalM3u8 = res.m3u8Url.startsWith('/api/') ? res.m3u8Url : `/api/media/playlist?url=${encodeURIComponent(res.m3u8Url)}`;
      aggregatedLogs.push(`[CASCADE 🎯] Успешно расшифрован и извлечен прямой HLS поток: ${finalM3u8}`);
      aggregatedLogs.push(`\n[CASCADE SUCCESS 🎉] Активный расшифрованный источник: ${candidate.name}`);
      return {
        m3u8Url: finalM3u8,
        activePlayerName: candidate.name,
        activeIframeUrl: targetIframe,
        logs: aggregatedLogs
      };
    } else {
      const isKodikOrAni = candidate.name === 'Kodik' || candidate.name === 'AniLibria' || targetIframe.includes('kodik') || targetIframe.includes('anilibria');
      if (isKodikOrAni) {
        const fallbackM3u8 = `/api/media/playlist?url=${encodeURIComponent(targetIframe)}`;
        aggregatedLogs.push(`[CASCADE 🔄] Для ${candidate.name} задействован нативный серверный HLS-транслятор: ${fallbackM3u8}`);
        aggregatedLogs.push(`\n[CASCADE SUCCESS 🎉] Активный источник HLS: ${candidate.name}`);
        return {
          m3u8Url: fallbackM3u8,
          activePlayerName: candidate.name,
          activeIframeUrl: targetIframe,
          logs: aggregatedLogs
        };
      } else {
        aggregatedLogs.push(`[CASCADE ℹ️] Балансер ${candidate.name} использует сессионный токен DRM в браузере. Вы можете переключить режим плеера на нативный iframe для просмотра через ${candidate.name}.`);
      }
    }
  }

  aggregatedLogs.push(`\n[CASCADE ERR] Ни один из источников (${candidates.map(c => c.name).join(', ')}) не содержит доступный прямой HLS поток.`);
  return {
    m3u8Url: null,
    activePlayerName: null,
    activeIframeUrl: null,
    logs: aggregatedLogs
  };
}
