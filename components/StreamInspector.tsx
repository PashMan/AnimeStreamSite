import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Terminal,
  Cpu,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  Wifi,
  ExternalLink,
  Sliders,
  ShieldCheck,
  Sparkles,
  Info
} from "lucide-react";

export interface StreamLogEntry {
  id: string;
  time: string;
  tag: "RESOLVER" | "HLS" | "DECODER" | "AI-PIPELINE" | "BUFFER" | "PLAYBACK" | "ERROR";
  type: "info" | "success" | "warn" | "error" | "ai";
  message: string;
}

export interface StreamTelemetryData {
  src: string;
  provider: string;
  nativeWidth: number;
  nativeHeight: number;
  renderWidth: number;
  renderHeight: number;
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  activeQuality: string;
  targetMode: string;
  isAiActive: boolean;
  hlsLevels: { height: number; width: number; bitrate: number; name: string }[];
  currentLevelIndex: number;
  bufferAheadSeconds: number;
  bandwidthMbps: number;
  currentTime: number;
  duration: number;
  playbackState: "playing" | "paused" | "buffering" | "idle";
}

interface StreamInspectorProps {
  telemetry?: StreamTelemetryData | null;
  logs?: StreamLogEntry[];
  onClearLogs?: () => void;
  className?: string;
  defaultExpanded?: boolean;
}

export const StreamInspector: React.FC<StreamInspectorProps> = ({
  telemetry,
  logs = [],
  onClearLogs,
  className = "",
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopiedUrl, setIsCopiedUrl] = useState(false);
  const [isCopiedReport, setIsCopiedReport] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isAutoScroll]);

  const handleCopyUrl = () => {
    if (!telemetry?.src) return;
    navigator.clipboard.writeText(telemetry.src);
    setIsCopiedUrl(true);
    setTimeout(() => setIsCopiedUrl(false), 2000);
  };

  const handleCopyReport = () => {
    const report = [
      `=== ОТЧЕТ ИНСПЕКТОРА ПОТОКА KAMIANIME ===`,
      `Время: ${new Date().toISOString()}`,
      `Источник / Балансер: ${telemetry?.provider || "Не определен"}`,
      `URL потока: ${telemetry?.src || "Н/Д"}`,
      `Нативный видеодекодер: ${telemetry?.nativeWidth || 0}x${telemetry?.nativeHeight || 0} px`,
      `Вывод рендера (Canvas): ${telemetry?.renderWidth || 0}x${telemetry?.renderHeight || 0} px (${telemetry?.targetMode || "Авто"})`,
      `AI Шейдерный апскейл: ${telemetry?.isAiActive ? "АКТИВЕН (Lanczos2 + Bilateral Edge Sharpening)" : "ВЫКЛЮЧЕН / Native Direct"}`,
      `Качество в плеере: ${telemetry?.activeQuality || "Авто"}`,
      `FPS: ${telemetry?.fps || 0} fps (Дропы: ${telemetry?.droppedFrames || 0} / ${telemetry?.totalFrames || 0})`,
      `Буфер вперед: ${(telemetry?.bufferAheadSeconds || 0).toFixed(1)} сек`,
      `HLS уровни: ${telemetry?.hlsLevels?.map(l => `${l.name || l.height + 'p'} (${(l.bitrate / 1000000).toFixed(1)} Mbps)`).join(", ") || "Н/Д"}`,
      ``,
      `--- ПОСЛЕДНИЕ СОБЫТИЯ ПОТОКА ---`,
      ...logs.slice(-30).map(l => `[${l.time}] [${l.tag}] ${l.message}`),
      `==========================================`
    ].join("\n");

    navigator.clipboard.writeText(report);
    setIsCopiedReport(true);
    setTimeout(() => setIsCopiedReport(false), 2500);
  };

  const filteredLogs = selectedTagFilter === "ALL"
    ? logs
    : logs.filter(l => l.tag === selectedTagFilter);

  const nativeHeight = telemetry?.nativeHeight || 0;
  const is1080pNative = nativeHeight >= 1000;
  const is720pNative = nativeHeight >= 700 && nativeHeight < 1000;
  const renderHeight = telemetry?.renderHeight || 0;

  return (
    <div
      id="stream-inspector-root"
      className={`w-full bg-[#13141a]/95 border border-white/10 rounded-[1.5rem] md:rounded-[1.75rem] overflow-hidden shadow-2xl backdrop-blur-xl transition-all font-sans text-white ${className}`}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-white/[0.04] to-transparent hover:bg-white/[0.06] cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] shrink-0">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Инспектор потока и логирование
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
              <span>{telemetry?.provider || "Kodik HLS"}</span>
              <span>•</span>
              <span className="font-semibold text-slate-200">
                {nativeHeight > 0 ? `Декодер: ${telemetry?.nativeWidth}×${nativeHeight}p` : "Ожидание видео..."}
              </span>
              <span>•</span>
              <span className={`font-black ${renderHeight >= 2000 ? "text-[#C084FC]" : "text-[#8B5CF6]"}`}>
                {renderHeight >= 2000 ? "4K (AI Super-Res)" : renderHeight >= 1000 ? "1080p (AI Upscale)" : "Native"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyReport();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Скопировать полный отчет для разработчиков"
          >
            {isCopiedReport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Отчет</span>
              </>
            )}
          </button>
          <div className="p-1.5 rounded-lg bg-white/5 text-slate-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5 border-t border-white/5 flex flex-col gap-5 animate-in slide-in-from-top-2 duration-200">
          {/* Top 4 Real-time Telemetry Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Card 1: Native Stream Decoder */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <span>Нативный поток</span>
                <Wifi className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                {nativeHeight > 0 ? (
                  <span className={is1080pNative ? "text-emerald-400" : is720pNative ? "text-cyan-400" : "text-amber-400"}>
                    {telemetry?.nativeWidth}×{nativeHeight}
                  </span>
                ) : (
                  <span className="text-slate-500 text-sm">Определение...</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                {is1080pNative ? "1080p FHD (Нативный)" : is720pNative ? "720p HD (Нативный)" : "SD / Auto"}
              </div>
            </div>

            {/* Card 2: AI WebGL Super-Res */}
            <div className="p-3.5 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[#C084FC] text-[11px] font-bold uppercase tracking-wider">
                <span>ИИ Рендеринг</span>
                <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                {renderHeight >= 2000 ? (
                  <span className="text-[#C084FC]">3840×2160 (4K)</span>
                ) : renderHeight >= 1000 ? (
                  <span className="text-[#8B5CF6]">1920×1080 (FHD)</span>
                ) : (
                  <span className="text-slate-400">Нативный</span>
                )}
              </div>
              <div className="text-[10px] text-purple-300/80 font-medium truncate">
                {telemetry?.isAiActive ? "Lanczos2 + Bilateral Sharpen" : "Bypass Mode"}
              </div>
            </div>

            {/* Card 3: Playback Performance (FPS & Drops) */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <span>Частота кадров</span>
                <Cpu className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                {(telemetry?.fps || 0) > 0 ? (
                  <span className="text-emerald-400">{telemetry?.fps} FPS</span>
                ) : (
                  <span className="text-slate-400">24.0 FPS</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Дропы: {telemetry?.droppedFrames || 0} из {telemetry?.totalFrames || 0} кадров
              </div>
            </div>

            {/* Card 4: Network & Buffer */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <span>Буфер и Сеть</span>
                <Layers className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                <span className="text-cyan-400">{(telemetry?.bufferAheadSeconds || 0).toFixed(1)} сек</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Битрейт: {telemetry?.bandwidthMbps ? `${telemetry.bandwidthMbps.toFixed(1)} Mbps` : "Оптимальный"}
              </div>
            </div>
          </div>

          {/* Direct Stream URL Bar with Copy Button */}
          {telemetry?.src && (
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white/5 px-2 py-0.5 rounded shrink-0">
                  URL потока
                </span>
                <span className="text-xs text-slate-300 font-mono truncate select-all">
                  {telemetry.src}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-[#8B5CF6] text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                title="Скопировать прямую ссылку на поток"
              >
                {isCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedUrl ? "Скопировано" : "Копировать URL"}</span>
              </button>
            </div>
          )}

          {/* HLS Manifest Levels Inspector */}
          {telemetry?.hlsLevels && telemetry.hlsLevels.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Обнаруженные потоки в HLS манифесте ({telemetry.hlsLevels.length}):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {telemetry.hlsLevels.map((lvl, idx) => {
                  const isCurrent = idx === telemetry.currentLevelIndex;
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                        isCurrent
                          ? "bg-[#8B5CF6]/20 border-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20"
                          : "bg-white/[0.03] border-white/5 text-slate-400"
                      }`}
                    >
                      <span className={isCurrent ? "text-[#C084FC]" : ""}>
                        {lvl.name || `${lvl.height}p`}
                      </span>
                      <span className="text-[10px] opacity-70 font-normal">
                        ({lvl.width}×{lvl.height} @ {(lvl.bitrate / 1000000).toFixed(1)} Mbps)
                      </span>
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real-Time Live Logs Terminal */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Журнал событий потока
                </span>
                <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full font-bold">
                  {filteredLogs.length} событий
                </span>
              </div>

              {/* Tag Filters & Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {["ALL", "RESOLVER", "HLS", "AI-PIPELINE", "DECODER"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTagFilter(tag)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                      selectedTagFilter === tag
                        ? "bg-[#8B5CF6] text-white"
                        : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {tag === "ALL" ? "Все" : tag}
                  </button>
                ))}

                {onClearLogs && (
                  <button
                    onClick={onClearLogs}
                    className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer ml-1"
                    title="Очистить логи"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Terminal Window */}
            <div
              ref={logContainerRef}
              className="w-full h-48 bg-black/80 border border-white/10 rounded-xl p-3 font-mono text-xs overflow-y-auto custom-scrollbar flex flex-col gap-1.5 select-text"
            >
              {filteredLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                  Нет событий для отображения...
                </div>
              ) : (
                filteredLogs.map((log) => {
                  let tagBg = "bg-white/10 text-slate-300";
                  if (log.type === "success") tagBg = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                  else if (log.type === "ai") tagBg = "bg-purple-500/20 text-purple-300 border border-purple-500/30";
                  else if (log.type === "warn") tagBg = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
                  else if (log.type === "error") tagBg = "bg-red-500/20 text-red-400 border border-red-500/30";

                  return (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-white/[0.02] px-1 py-0.5 rounded">
                      <span className="text-slate-500 text-[10px] shrink-0 pt-0.5 select-none">
                        [{log.time}]
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 ${tagBg}`}>
                        {log.tag}
                      </span>
                      <span className={`text-slate-200 text-xs break-all ${log.type === 'ai' ? 'text-purple-200' : ''}`}>
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
