import React, { useState, useEffect, useRef } from "react";
import { Download, Loader2, Film, CheckCircle, AlertTriangle, Monitor, Server } from "lucide-react";

interface BrowserDownloadWidgetProps {
  episodeUrl: string;
  animeTitle: string;
  episodeNumber: string | number;
  shikimoriId?: string | number;
  translationId?: string | number;
}

interface DownloadProgress {
  id: string;
  stage: string;
  processed: number;
  total: number;
  progress: number;
  status: 'running' | 'success' | 'failed';
  error?: string;
  fileName?: string;
}

export const BrowserDownloadWidget: React.FC<BrowserDownloadWidgetProps> = ({
  episodeUrl,
  animeTitle,
  episodeNumber,
  shikimoriId,
  translationId,
}) => {
  const [qualities, setQualities] = useState<string[]>([]);
  const [loadingQualities, setLoadingQualities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [downloadMethod, setDownloadMethod] = useState<'server' | 'client'>('server');
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [localDownloadBlobUrl, setLocalDownloadBlobUrl] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load available qualities from Kodik playlist endpoint with absolute defensive parsing
  useEffect(() => {
    if (!episodeUrl) return;

    const fetchQualities = async () => {
      setLoadingQualities(true);
      setError(null);
      setQualities([]);
      try {
        const res = await fetch(`/api/media/playlist?url=${encodeURIComponent(episodeUrl)}&resolve=true`);
        
        const text = await res.text();
        const trimmed = text.trim().toLowerCase();
        const isHtml = trimmed.startsWith("<!doctype") || trimmed.startsWith("<html") || trimmed.startsWith("<head") || trimmed.startsWith("<body");
        if (isHtml || !res.ok) {
          throw new Error("Браузер заблокировал сторонние куки-файлы (или получен некорректный ответ от API). Пожалуйста, отключите блокировщики рекламы, попробуйте открыть страницу в новой вкладке, либо воспользуйтесь нашим Telegram-ботом ниже!");
        }

        const data = JSON.parse(text);
        if (data.success && data.qualities) {
          const sorted = [...data.qualities].sort((a, b) => Number(b) - Number(a));
          setQualities(sorted.map(String));
        } else {
          throw new Error("Качество видео не определено");
        }
      } catch (err: any) {
        console.error("Error fetching qualities:", err);
        setError(err.message || "Ошибка загрузки потока");
      } finally {
        setLoadingQualities(false);
      }
    };

    fetchQualities();
    
    // Clear download state when episode changes
    setProgress(null);
    setDownloading(false);
    setCurrentTaskId(null);
    if (localDownloadBlobUrl) {
      URL.revokeObjectURL(localDownloadBlobUrl);
      setLocalDownloadBlobUrl(null);
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, [episodeUrl]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (localDownloadBlobUrl) URL.revokeObjectURL(localDownloadBlobUrl);
    };
  }, [localDownloadBlobUrl]);

  const handleStartDownload = async (quality: string) => {
    if (downloading) return;
    setError(null);
    setSelectedQuality(quality);
    setDownloading(true);
    setProgress(null);
    setCurrentTaskId(null);

    if (localDownloadBlobUrl) {
      URL.revokeObjectURL(localDownloadBlobUrl);
      setLocalDownloadBlobUrl(null);
    }

    if (downloadMethod === 'server') {
      // SERVER-SIDE HIGH SPEED MP4 DOWNLOAD
      const startUrl = `/api/media/download/start?url=${encodeURIComponent(episodeUrl)}&quality=${quality}&title=${encodeURIComponent(animeTitle)}&episode=${episodeNumber}`;
      try {
        const res = await fetch(startUrl);
        const text = await res.text();
        
        if (!res.ok) {
          throw new Error(`Ошибка запуска сервера: ${res.statusText}`);
        }
        
        const data = JSON.parse(text);
        if (data.success && data.taskId) {
          setCurrentTaskId(data.taskId);
          setProgress({
            id: data.taskId,
            stage: "resolving",
            processed: 0,
            total: 0,
            progress: 5,
            status: "running",
            fileName: data.fileName || `${animeTitle}_Ep_${episodeNumber}_${quality}p.mp4`
          });
          startServerPolling(data.taskId);
        } else {
          throw new Error(data.error || "Не удалось запустить сборку серии на сервере.");
        }
      } catch (err: any) {
        console.error("Server-side start download failed:", err);
        setError(err.message || "Ошибка соединения с сервером сборки.");
        setDownloading(false);
      }
    } else {
      // CLIENT-SIDE BROWSER TS DOWNLOAD (Alternative fallback)
      const fileName = `${animeTitle.replace(/[\/:*?"<>|]/g, "_")}_Ep_${episodeNumber}_${quality}p.ts`;

      try {
        const playlistUrl = `/api/media/playlist?url=${encodeURIComponent(episodeUrl)}&quality=${quality}`;
        const playlistRes = await fetch(playlistUrl);
        
        const playlistText = await playlistRes.text();
        const trimmedText = playlistText.trim().toLowerCase();
        const isHtmlResponse = trimmedText.startsWith("<!doctype") || trimmedText.startsWith("<html") || trimmedText.startsWith("<head") || trimmedText.startsWith("<body");
        if (isHtmlResponse || !playlistRes.ok) {
          throw new Error("Не удалось загрузить плейлист потока от сервера. Возможно, блокируются сторонние куки-файлы в iframe.");
        }

        const lines = playlistText.split("\n");
        const segmentUrls: string[] = [];
        for (let line of lines) {
          line = line.trim();
          if (line && !line.startsWith("#")) {
            if (line.startsWith("/")) {
              segmentUrls.push(window.location.origin + line);
            } else if (!line.startsWith("http")) {
              segmentUrls.push(window.location.origin + "/api/media/" + line);
            } else {
              segmentUrls.push(line);
            }
          }
        }

        const total = segmentUrls.length;
        if (total === 0) {
          throw new Error("Не удалось извлечь фрагменты видео из плейлиста для скачивания.");
        }

        setProgress({
          id: "client_download",
          stage: "downloading",
          processed: 0,
          total,
          progress: 0,
          status: "running",
          fileName
        });

        const concurrency = 8;
        const results = new Array<ArrayBuffer>(total);
        let completedCount = 0;
        let activeIndex = 0;

        const downloadChunk = async (index: number, url: string) => {
          let attempt = 0;
          const maxAttempts = 3;
          while (attempt < maxAttempts) {
            try {
              attempt++;
              const segmentRes = await fetch(url);
              if (!segmentRes.ok) throw new Error(`Chunk status: ${segmentRes.status}`);
              const buf = await segmentRes.arrayBuffer();
              results[index] = buf;
              return;
            } catch (chunkErr) {
              console.warn(`Attempt ${attempt} failed for chunk index ${index}:`, chunkErr);
              if (attempt === maxAttempts) {
                throw new Error(`Ошибка загрузки фрагмента ${index + 1} из ${total}. Пожалуйста, перезапустите скачивание.`);
              }
              await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
            }
          }
        };

        const worker = async () => {
          while (activeIndex < total) {
            const currentIndex = activeIndex++;
            await downloadChunk(currentIndex, segmentUrls[currentIndex]);
            completedCount++;
            
            const percent = Math.round((completedCount / total) * 100);
            setProgress({
              id: "client_download",
              stage: "downloading",
              processed: completedCount,
              total,
              progress: percent,
              status: "running",
              fileName
            });
          }
        };

        const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
        await Promise.all(workers);

        setProgress({
          id: "client_download",
          stage: "merging",
          processed: total,
          total,
          progress: 99,
          status: "running",
          fileName
        });

        const blob = new Blob(results, { type: "video/mp2t" });
        const localUrl = URL.createObjectURL(blob);
        setLocalDownloadBlobUrl(localUrl);

        setProgress({
          id: "client_download",
          stage: "ready",
          processed: total,
          total,
          progress: 100,
          status: "success",
          fileName
        });

        const link = document.createElement("a");
        link.href = localUrl;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setDownloading(false);
      } catch (err: any) {
        console.error("Browser download failed:", err);
        setError(err.message || "Ошибка при скачивании");
        setDownloading(false);
        setProgress({
          id: "client_download",
          stage: "failed",
          processed: 0,
          total: 1,
          progress: 0,
          status: "failed",
          error: err.message || "Ошибка скачивания фрагментов"
        });
      }
    }
  };

  const startServerPolling = (tid: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/media/download/progress?taskId=${tid}`);
        const text = await res.text();
        
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
          return;
        }

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Задача скачивания не найдена или прекращена на сервере.");
          }
          return;
        }

        const data: DownloadProgress = JSON.parse(text);
        setProgress(data);

        if (data.status === "success") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setDownloading(false);
          triggerServerFileDownload(tid, data.fileName || "video.mp4");
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setError(data.error || "Не удалось конвертировать серию на сервере.");
          setDownloading(false);
        }
      } catch (err: any) {
        console.error("Server polling error:", err);
        setError(err.message || "Ошибка связи с сервером сборщика");
        setDownloading(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 1500);
  };

  const triggerServerFileDownload = (tid: string, name: string) => {
    const downloadUrl = `/api/media/download/file?taskId=${tid}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStageMessage = (stage: string) => {
    switch (stage) {
      case "resolving":
        return "Подключение к стриминг-серверу...";
      case "downloading":
        return progress 
          ? `Скачивание фрагментов на сервер (${progress.processed} из ${progress.total || "..."})...` 
          : "Скачивание фрагментов на сервер...";
      case "merging":
        return "Соединение сегментов видеопотока...";
      case "muxing":
        return "Упаковка и конвертация видео в формат MP4 (без потери качества)...";
      case "ready":
        return "Готово к сохранению!";
      case "failed":
        return "Ошибка!";
      default:
        return "Подготовка...";
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-all duration-300 space-y-5">
      
      {/* METHOD SELECTOR */}
      <div className="grid grid-cols-2 gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => {
            if (!downloading) {
              setDownloadMethod('server');
              setError(null);
              setProgress(null);
            }
          }}
          disabled={downloading}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer ${
            downloadMethod === 'server'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          } disabled:opacity-50`}
        >
          <Server className="w-3.5 h-3.5 shrink-0" />
          <span>Скачать .MP4 (Сервер)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!downloading) {
              setDownloadMethod('client');
              setError(null);
              setProgress(null);
            }
          }}
          disabled={downloading}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer ${
            downloadMethod === 'client'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          } disabled:opacity-50`}
        >
          <Monitor className="w-3.5 h-3.5 shrink-0" />
          <span>Скачать .TS (Браузер)</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs uppercase tracking-wider font-extrabold text-slate-400">
          Выберите качество:
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {loadingQualities && (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold py-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              Проверка доступных вариантов...
            </div>
          )}

          {error && (
            <div className="text-red-400 text-xs font-semibold flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl w-full">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loadingQualities && qualities.length > 0 && !downloading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full pt-1">
              {qualities.map((qual) => (
                <button
                  key={qual}
                  onClick={() => handleStartDownload(qual)}
                  disabled={downloading}
                  className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-cyan-500 hover:text-white border border-white/5 hover:border-cyan-500 transition-all duration-300 text-slate-200 font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  {qual}p ({downloadMethod === 'server' ? '.mp4' : '.ts'})
                </button>
              ))}
            </div>
          )}

          {!loadingQualities && qualities.length === 0 && !error && (
            <span className="text-slate-400 text-xs">Качество не определено</span>
          )}
        </div>
      </div>

      {/* DETAILED FEATURES ALERT EXPLAINER */}
      {downloadMethod === 'server' ? (
        <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-xl p-4.5 space-y-2 text-slate-300">
          <p className="text-cyan-400 font-bold text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            Преимущества сервера (Формат .MP4):
          </p>
          <ul className="text-xs list-disc pl-4 space-y-2 leading-relaxed">
            <li>
              Наш сервер собирает фрагменты по высокоскоростной локальной гигабитной сети, соединяет их и <strong className="text-white">автоматически конвертирует видео в стандартный MP4-формат</strong> с помощью утилиты FFmpeg.
            </li>
            <li>
              Готовый MP4 файл идеально открывается на любом устройстве: на айфоне, андроиде, компьютере и телевизоре без установки сторонних плееров!
            </li>
          </ul>
        </div>
      ) : (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4.5 space-y-2 text-slate-300">
          <p className="text-amber-400 font-bold text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            Особенности браузера (Формат .TS):
          </p>
          <ul className="text-xs list-disc pl-4 space-y-2 leading-relaxed">
            <li>
              Браузер скачивает сотни сегментов напрямую на Ваш ПК в буфер. Из-за лимитов браузера Chrome/Safari (до 6 одновременных закачек) загрузка идет медленнее.
            </li>
            <li>
              Поскольку браузер не может произвести конвертацию без серверов, файл сохраняется <strong className="text-amber-400">как черновой видеопоток .ts</strong>. Для его запуска понадобится универсальный плеер вроде <strong className="text-cyan-400">VLC Media Player или PotPlayer</strong>.
            </li>
          </ul>
        </div>
      )}

      {downloading && progress && (
        <div className="border-t border-white/5 pt-5 space-y-2.5 animate-fade-in">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>{getStageMessage(progress.stage)}</span>
            </div>
            <span className="font-mono text-cyan-400 font-bold text-xs bg-cyan-500/10 px-2 py-0.5 rounded">
              {progress.progress}%
            </span>
          </div>

          <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* SUCCESS BANNER */}
      {!downloading && progress?.status === "success" && (
        <div className="border-t border-white/5 pt-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-cyan-500/5 border border-cyan-500/15 p-4 rounded-xl transition-all duration-300 font-sans">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-cyan-400 shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">Файл успешно собран!</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {downloadMethod === 'server' 
                  ? "Полностью готовый MP4-файл собран и уже скачивается на устройство." 
                  : "Черновой медиафайл .TS собран и передан в загрузки браузера."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (downloadMethod === 'server' && currentTaskId) {
                triggerServerFileDownload(currentTaskId, progress.fileName || "video.mp4");
              } else if (downloadMethod === 'client' && localDownloadBlobUrl) {
                const link = document.createElement("a");
                link.href = localDownloadBlobUrl;
                link.setAttribute("download", progress.fileName || "video.ts");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Сохранить {downloadMethod === 'server' ? '.MP4' : '.TS'}
          </button>
        </div>
      )}

      {shikimoriId && (
        <div className="border-t border-white/10 pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0088cc]/5 border border-[#0088cc]/10 p-5 rounded-2xl">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-[#0088cc]/25 text-[#0088cc] rounded-xl self-start mt-0.5 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.1.02-1.62 1.03-4.57 3.03-.43.3-.82.44-1.17.43-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.4.81-.6 3.19-1.39 5.32-2.3 6.39-2.73 3.04-1.24 3.67-1.45 4.09-1.46.09 0 .3.02.43.13.11.09.14.21.16.3.02.08.03.24.01.37z" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Альтернативный способ: Скачать через Telegram</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Наш Telegram-бот работает на выделенных серверах с мощными утилитами. Он моментально собирает серию без лимитов браузера и присылает Вам готовую запись <strong className="text-white">сразу в формате .MP4</strong>, идеально подходящую для воспроизведения на стандартном плеере любого телефона (iPhone / Android) и ТВ!
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const botUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME) || "KamiAnime_bot";
                window.open(`https://t.me/${botUsername}?start=dl_${shikimoriId}_ep${episodeNumber}_tr${translationId || 0}`, "_blank");
              }}
              className="w-full sm:w-auto px-5 py-3 bg-[#0088cc] hover:bg-[#008cdd] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shrink-0 text-center"
            >
              Скачать в ТГ (.MP4)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
