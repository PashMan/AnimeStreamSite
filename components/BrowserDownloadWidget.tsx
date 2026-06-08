import React, { useState, useEffect, useRef } from "react";
import { Download, Loader2, Film, CheckCircle, AlertTriangle } from "lucide-react";

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
  
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
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
          throw new Error("Браузер заблокировал сторонние cookie-файлы во встроенном фрейме Google AI Studio (либо получен некорректный HTML-ответ). Пожалуйста, в правом верхнем углу интерфейса AI Studio нажмите кнопку «Open in new tab» (Открыть в новой вкладке) — плеер и скачивание заработают без ограничений, или воспользуйтесь нашим Telegram-ботом ниже!");
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
    setTaskId(null);
    setProgress(null);
    setDownloading(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, [episodeUrl]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleStartDownload = async (quality: string) => {
    if (downloading) return;
    setError(null);
    setSelectedQuality(quality);
    setDownloading(true);
    setTaskId(null);
    setProgress(null);

    try {
      const res = await fetch(
        `/api/media/download/start?url=${encodeURIComponent(episodeUrl)}&quality=${quality}&title=${encodeURIComponent(animeTitle)}&episode=${episodeNumber}`
      );
      
      const text = await res.text();
      if (!res.ok) {
        let errorMsg = "Не удалось запустить скачивание.";
        try {
          const errObj = JSON.parse(text);
          if (errObj && errObj.message) {
            errorMsg = `Ошибка: ${errObj.message}`;
          } else if (errObj && errObj.error) {
             errorMsg = `Ошибка: ${errObj.error}`;
          }
        } catch {
          if (text && text.length < 150) {
            errorMsg = `Ошибка: ${text}`;
          }
        }
        throw new Error(errorMsg);
      }
      
      const trimmedText = text.trim().toLowerCase();
      const isHtmlResponse = trimmedText.startsWith("<!doctype") || trimmedText.startsWith("<html") || trimmedText.startsWith("<head") || trimmedText.startsWith("<body");
      if (isHtmlResponse) {
        throw new Error("Браузер заблокировал сторонние cookie-файлы во встроенном фрейме Google AI Studio (либо получен некорректный HTML-ответ). Пожалуйста, в правом верхнем углу интерфейса AI Studio нажмите кнопку «Open in new tab» (Открыть в новой вкладке) — плеер и скачивание заработают без ограничений, или воспользуйтесь нашим Telegram-ботом ниже!");
      }
      
      const data = JSON.parse(text);
      if (data.success && data.taskId) {
        setTaskId(data.taskId);
        startPolling(data.taskId);
      } else {
        throw new Error(data.error || "Ошибка запуска");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка соединения");
      setDownloading(false);
    }
  };

  const startPolling = (tid: string) => {
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
             throw new Error("Задача скачивания не найдена на сервере");
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
          triggerFileDownload(tid, data.fileName || "video.mp4");
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setError(data.error || "Ошибка сборки файла");
          setDownloading(false);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        setError(err.message || "Потеряно подключение");
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

  const triggerFileDownload = (tid: string, name: string) => {
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
        return "Подключение...";
      case "downloading":
        return "Скачивание...";
      case "merging":
        return "Сборка файла...";
      case "muxing":
        return "Обработка...";
      case "ready":
        return "Завершение...";
      case "failed":
        return "Ошибка";
      default:
        return "Запуск скачивания...";
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 transition-all duration-300">
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
                  {qual}p
                </button>
              ))}
            </div>
          )}

          {!loadingQualities && qualities.length === 0 && !error && (
            <span className="text-slate-400 text-xs">Качество не определено</span>
          )}
        </div>
      </div>

      {downloading && progress && (
        <div className="mt-5 border-t border-white/5 pt-5 space-y-2.5 animate-fade-in">
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

      {!downloading && progress?.status === "success" && (
        <div className="mt-5 border-t border-white/5 pt-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-cyan-500/5 border border-cyan-500/10 p-4 rounded-xl transition-all duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-cyan-400 shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">Готово!</p>
              <p className="text-slate-400 text-xs mt-0.5">Файл автоматически скачивается на устройство.</p>
            </div>
          </div>
          <button
            onClick={() => triggerFileDownload(progress.id, progress.fileName || "video.mp4")}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Скачать файл
          </button>
        </div>
      )}

      {shikimoriId && (
        <div className="mt-6 border-t border-white/10 pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0088cc]/5 border border-[#0088cc]/10 p-5 rounded-2xl">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-[#0088cc]/25 text-[#0088cc] rounded-xl self-start mt-0.5 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.1.02-1.62 1.03-4.57 3.03-.43.3-.82.44-1.17.43-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.4.81-.6 3.19-1.39 5.32-2.3 6.39-2.73 3.04-1.24 3.67-1.45 4.09-1.46.09 0 .3.02.43.13.11.09.14.21.16.3.02.08.03.24.01.37z" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Скачать через Telegram-Бот</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Не получается скачать на сайте из-за медленных серверов или блокировок? Запустите нашего аниме-бота — он мгновенно соберет серию на высокоскоростных серверах пространства Hugging Face Space и пришлет готовым файлом прямо в Telegram!
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
              Скачать в ТГ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
