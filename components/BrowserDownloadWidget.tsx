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
          throw new Error("Не удалось получить видео-поток. Пожалуйста, попробуйте еще раз позже.");
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
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || !res.ok) {
        throw new Error("Не удалось запустить скачивание. Попробуйте еще раз.");
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
    </div>
  );
};
