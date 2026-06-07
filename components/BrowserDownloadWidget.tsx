import React, { useState, useEffect, useRef } from "react";
import { Download, Loader2, Film, CheckCircle, AlertTriangle } from "lucide-react";

interface BrowserDownloadWidgetProps {
  episodeUrl: string;
  animeTitle: string;
  episodeNumber: string | number;
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
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || !res.ok) {
          throw new Error("Сервер не вернул список видео. Пожалуйста, обновите страницу или повторите попытку позже.");
        }

        const data = JSON.parse(text);
        if (data.success && data.qualities) {
          const sorted = [...data.qualities].sort((a, b) => Number(b) - Number(a));
          setQualities(sorted.map(String));
        } else {
          throw new Error("Варианты качества видео не найдены");
        }
      } catch (err: any) {
        console.error("Error fetching qualities:", err);
        setError(err.message || "Ошибка при получении качеств видео");
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
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || !res.ok) {
        throw new Error("Не удалось запустить сборку видеофайла на сервере. Пожалуйста, попробуйте еще раз.");
      }
      
      const data = JSON.parse(text);
      if (data.success && data.taskId) {
        setTaskId(data.taskId);
        startPolling(data.taskId);
      } else {
        throw new Error(data.error || "Ошибка инициализации загрузки");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка подключения к серверу");
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
          // If returned HTML, ignore or wait next attempt to avoid crashing
          return;
        }

        if (!res.ok) {
          if (res.status === 404) {
             throw new Error("Задача на сервере завершилась или не найдена");
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
          setError(data.error || "Сборка видеофайла прервалась ошибкой");
          setDownloading(false);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        setError(err.message || "Потеряно подключение к серверу");
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
        return "Подготовка потока...";
      case "downloading":
        return `Загрузка сегментов... (${progress?.processed || 0}/${progress?.total || 1})`;
      case "merging":
        return "Сборка видеофайла...";
      case "muxing":
        return "Оптимизация формата...";
      case "ready":
        return "Передача в браузер...";
      case "failed":
        return "Ошибка.";
      default:
        return "Запуск...";
    }
  };

  return (
    <div className="bg-[#1f2937]/50 border border-white/5 rounded-2xl p-6 transition-all duration-300">
      <div className="flex flex-col gap-4">
        <label className="text-sm font-semibold text-slate-300 tracking-wide">
          Выберите качество:
        </label>

        <div className="flex flex-wrap items-center gap-3">
          {loadingQualities && (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium py-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              Загрузка доступного качества...
            </div>
          )}

          {error && (
            <div className="text-red-400 text-xs font-semibold flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl w-full">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loadingQualities && qualities.length > 0 && !downloading && (
            <div className="flex flex-wrap gap-2 w-full">
              {qualities.map((qual) => (
                <button
                  key={qual}
                  onClick={() => handleStartDownload(qual)}
                  disabled={downloading}
                  className="flex items-center gap-1.5 bg-[#111827] hover:bg-amber-500 hover:text-black border border-white/10 hover:border-amber-400 transition-all duration-300 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  {qual}p
                </button>
              ))}
            </div>
          )}

          {!loadingQualities && qualities.length === 0 && !error && (
            <span className="text-slate-400 text-xs">Доступное качество не обнаружено</span>
          )}
        </div>
      </div>

      {downloading && progress && (
        <div className="mt-6 border-t border-white/5 pt-6 space-y-3 animate-fade-in">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>{getStageMessage(progress.stage)}</span>
            </div>
            <span className="font-mono text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded">
              {progress.progress}%
            </span>
          </div>

          <div className="h-2 w-full bg-[#111827] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-right">
            Пожалуйста, не закрывайте вкладку во время скачивания.
          </p>
        </div>
      )}

      {!downloading && progress?.status === "success" && (
        <div className="mt-6 border-t border-white/5 pt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 p-4 rounded-xl transition-all duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">Готово!</p>
              <p className="text-slate-400 text-xs mt-0.5">Файл подготовлен и передан браузеру.</p>
            </div>
          </div>
          <button
            onClick={() => triggerFileDownload(progress.id, progress.fileName || "video.mp4")}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Скачать файл
          </button>
        </div>
      )}
    </div>
  );
};
