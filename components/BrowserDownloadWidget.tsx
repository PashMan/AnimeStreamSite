import React, { useState, useEffect, useRef } from "react";
import { Download, Loader2, Film, CheckCircle, AlertTriangle, ArrowDownToLine } from "lucide-react";

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

  // Load available qualities from Kodik playlist endpoint
  useEffect(() => {
    if (!episodeUrl) return;

    const fetchQualities = async () => {
      setLoadingQualities(true);
      setError(null);
      setQualities([]);
      try {
        const res = await fetch(`/api/media/playlist?url=${encodeURIComponent(episodeUrl)}&resolve=true`);
        if (!res.ok) throw new Error("Не удалось получить список качеств видео");
        const data = await res.json();
        if (data.success && data.qualities) {
          // Sort descending
          const sorted = [...data.qualities].sort((a, b) => Number(b) - Number(a));
          setQualities(sorted.map(String));
        } else {
          throw new Error("Не найдено доступных вариантов качества видео");
        }
      } catch (err: any) {
        console.error("Error fetching qualities:", err);
        setError(err.message || "Ошибка при получении качеств стрима");
      } finally {
        setLoadingQualities(false);
      }
    };

    fetchQualities();
    
    // Clear download state when episodeUrl changes
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
      if (!res.ok) throw new Error("Не удалось запустить процесс сборки видеофайла на сервере");
      
      const data = await res.json();
      if (data.success && data.taskId) {
        setTaskId(data.taskId);
        startPolling(data.taskId);
      } else {
        throw new Error(data.error || "Ошибка инициализации загрузки");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка подключения");
      setDownloading(false);
    }
  };

  const startPolling = (tid: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/media/download/progress?taskId=${tid}`);
        if (!res.ok) {
          if (res.status === 404) {
             throw new Error("Задача на сервере не найдена");
          }
          return;
        }
        const data: DownloadProgress = await res.json();
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
          setError(data.error || "Сборка видеофайла прервалась ошибкой на сервере");
          setDownloading(false);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        setError(err.message || "Потеряно подключение к серверу во время сборки");
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
        return "🔍 Получение ссылки на поток от Kodik Player...";
      case "downloading":
        return `📥 Быстрое скачивание видео-сегментов... (${progress?.processed || 0}/${progress?.total || 1})`;
      case "merging":
        return "⚡ Склеивание сегментов в медиапоток без потери качества...";
      case "muxing":
        return "⚙️ Сохранение в готовый MP4 контейнер...";
      case "ready":
        return "🍿 Готово! Видео передается в браузер...";
      case "failed":
        return "❌ Сбой сборки файла.";
      default:
        return "🚀 Запуск процесса...";
    }
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-6 md:p-8 mt-10 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h4 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-amber-500 animate-bounce" />
            Прямое скачивание в браузере
          </h4>
          <p className="text-slate-400 text-xs mt-1 max-w-xl">
            Скачивайте серию в максимальном качестве сразу к себе на устройство (ПК, телефон, ТВ) на полной скорости вашего интернета, в обход любых ограничений Telegram.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {loadingQualities && (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              Сканирование качеств...
            </div>
          )}

          {error && (
            <div className="text-red-400 text-xs font-semibold flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {!loadingQualities && qualities.length > 0 && !downloading && (
            <div className="flex flex-wrap gap-2">
              {qualities.map((qual) => (
                <button
                  key={qual}
                  onClick={() => handleStartDownload(qual)}
                  disabled={downloading}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-amber-500 hover:text-black border border-white/10 hover:border-amber-400 transition-all duration-300 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl cursor-pointer shadow-lg shadow-black/20"
                >
                  <Film className="w-3.5 h-3.5" />
                  {qual}p
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {downloading && progress && (
        <div className="mt-6 border-t border-white/5 pt-6 space-y-3 animate-fade-in">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 font-black text-slate-300 uppercase tracking-wider">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              {getStageMessage(progress.stage)}
            </div>
            <span className="font-mono text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded">
              {progress.progress}%
            </span>
          </div>

          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider self-end">
            Пожалуйста, не закрывайте страницу до завершения сборки серии...
          </p>
        </div>
      )}

      {!downloading && progress?.status === "success" && (
        <div className="mt-6 border-t border-white/5 pt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 p-4 rounded-2xl transition-all duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">Сборка успешно завершена!</p>
              <p className="text-slate-400 text-xs mt-0.5">Файл {progress.fileName} подготовлен без потери качества.</p>
            </div>
          </div>
          <button
            onClick={() => triggerFileDownload(progress.id, progress.fileName || "video.mp4")}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105"
          >
            <Download className="w-4 h-4" />
            Скачать файл
          </button>
        </div>
      )}
    </div>
  );
};
