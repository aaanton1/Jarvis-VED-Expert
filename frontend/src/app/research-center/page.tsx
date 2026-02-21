"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Search,
  TrendingUp,
  Skull,
  Zap,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Loader2,
  AlertCircle,
  Activity,
  CheckCircle2,
  Brain,
  FileSearch,
  ChevronDown,
} from "lucide-react";

// ---------- Types ----------

interface DeathReason {
  reason: string;
  description: string;
  severity: number;
  evidence: string;
}

interface PainPoint {
  pain: string;
  source: string;
  severity: number;
}

interface ResearchResult {
  verdict: string;
  score: number;
  summary: string;
  deathReasons: DeathReason[];
  painPoints: PainPoint[];
  marketOverview: string;
}

interface ProgressEvent {
  stage: string;
  message: string;
  progress: number;
  result?: ResearchResult;
}

// ---------- Constants ----------

const STAGES = [
  { key: "started", label: "Запуск", icon: Rocket },
  { key: "trend_search", label: "Поиск", icon: Search },
  { key: "trend_analysis", label: "Анализ трендов", icon: FileSearch },
  { key: "critical_analysis", label: "Критика", icon: Brain },
  { key: "saving_report", label: "Сохранение", icon: Activity },
  { key: "completed", label: "Готово", icon: CheckCircle2 },
];

// ---------- Animation variants ----------

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const gridContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// ---------- Helpers ----------

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "HIGH_RISK")
    return <ShieldAlert className="w-8 h-8 text-red-400" />;
  if (verdict === "MEDIUM_RISK")
    return <ShieldQuestion className="w-8 h-8 text-yellow-400" />;
  return <ShieldCheck className="w-8 h-8 text-green-400" />;
}

function verdictColor(verdict: string) {
  if (verdict === "HIGH_RISK") return "text-red-400";
  if (verdict === "MEDIUM_RISK") return "text-yellow-400";
  return "text-green-400";
}

function verdictBg(verdict: string) {
  if (verdict === "HIGH_RISK") return "bg-red-500/10 border-red-500/20";
  if (verdict === "MEDIUM_RISK") return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-green-500/10 border-green-500/20";
}

function SeverityBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color =
    pct > 70 ? "bg-red-500" : pct > 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

// ---------- Glass Card wrapper ----------

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={cardVariants}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-2xl border border-white/[0.06] p-6 ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
      }}
    >
      {children}
    </motion.div>
  );
}

// ---------- Main Component ----------

export default function ResearchCenter() {
  const [keyword, setKeyword] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentStage, setCurrentStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startResearch = async () => {
    if (!keyword.trim() || isRunning) return;

    setIsRunning(true);
    setEvents([]);
    setCurrentStage("started");
    setProgress(0);
    setResult(null);
    setError(null);
    setDetailsExpanded(false);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // SSE через Next.js proxy
      const es = new EventSource(`/api/research/${data.id}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        const event: ProgressEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
        setCurrentStage(event.stage);
        setProgress(Math.max(0, event.progress));

        if (event.stage === "completed" && event.result) {
          setResult(event.result);
          setIsRunning(false);
          es.close();
        }
        if (event.stage === "error") {
          setError(event.message);
          setIsRunning(false);
          es.close();
        }
      };

      es.onerror = () => {
        setError("Потеряно соединение с сервером");
        setIsRunning(false);
        es.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold tracking-tight text-white/90 mb-3">
          Research Center
        </h1>
        <p className="text-base text-white/35 max-w-lg mx-auto">
          Введите бизнес-нишу. AI-агенты найдут тренды, боли клиентов и
          оценят жизнеспособность идеи.
        </p>
      </motion.div>

      {/* Apple-style Input */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="relative mb-14"
      >
        <div
          className="flex items-center gap-3 rounded-2xl border border-white/[0.08] px-5 py-4 transition-all duration-300 focus-within:border-white/20 focus-within:shadow-[0_0_30px_rgba(255,255,255,0.04)]"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
          }}
        >
          <Search className="w-5 h-5 text-white/20 shrink-0" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startResearch()}
            placeholder="напр. автоматизация для стоматологий"
            disabled={isRunning}
            className="flex-1 bg-transparent text-white text-lg placeholder-white/25 focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={startResearch}
            disabled={isRunning || !keyword.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.14] active:scale-[0.97] transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            {isRunning ? "Агенты работают..." : "Запустить AI-агентов"}
          </button>
        </div>
      </motion.div>

      {/* Progress */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-10 overflow-hidden"
          >
            <div
              className="rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              {/* Stage indicators */}
              <div className="flex items-center gap-2 mb-6">
                {STAGES.map((s) => {
                  const stageIdx = STAGES.findIndex(
                    (st) => st.key === currentStage
                  );
                  const thisIdx = STAGES.findIndex((st) => st.key === s.key);
                  const isDone = thisIdx < stageIdx;
                  const isActive = s.key === currentStage;
                  const Icon = s.icon;
                  return (
                    <div key={s.key} className="flex-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon
                          className={`w-3.5 h-3.5 ${isActive ? "text-blue-400" : isDone ? "text-green-400" : "text-white/15"}`}
                        />
                        <span
                          className={`text-[10px] ${isActive ? "text-blue-400" : isDone ? "text-white/45" : "text-white/15"}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isDone
                              ? "bg-green-500/70 w-full"
                              : isActive
                                ? "bg-blue-500 w-full animate-pulse"
                                : "w-0"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Global bar */}
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-4">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>

              {/* Log */}
              <div className="max-h-24 overflow-y-auto text-[11px] text-white/30 space-y-0.5 font-mono">
                {events.map((e, i) => (
                  <div key={i}>
                    <span className="text-white/15">{e.stage}</span>{" "}
                    {e.message}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 mb-10 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400/80 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Grid */}
      <AnimatePresence>
        {result && (
          <motion.div
            variants={gridContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {/* Verdict — full width */}
            <GlassCard className={`md:col-span-2 ${verdictBg(result.verdict)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <VerdictIcon verdict={result.verdict} />
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-semibold text-white/85">
                        Вердикт
                      </h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          result.verdict === "HIGH_RISK"
                            ? "bg-red-500/20 text-red-400"
                            : result.verdict === "MEDIUM_RISK"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-green-500/20 text-green-400"
                        }`}
                      >
                        {result.verdict === "HIGH_RISK" ? "Высокий риск" : result.verdict === "MEDIUM_RISK" ? "Средний риск" : "Низкий риск"}
                      </span>
                    </div>
                    <p className="text-sm text-white/40 max-w-2xl">
                      {result.summary}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-4xl font-bold tabular-nums ${verdictColor(result.verdict)}`}
                >
                  {result.score}
                </span>
              </div>

              {/* Expand Details Button */}
              <button
                onClick={() => setDetailsExpanded((prev) => !prev)}
                className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] text-white/50 text-sm font-medium hover:bg-white/[0.1] hover:text-white/70 active:scale-[0.97] transition-all mx-auto"
              >
                <motion.span
                  animate={{ rotate: detailsExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.span>
                {detailsExpanded ? "Свернуть детали" : "Развернуть детали"}
              </button>
            </GlassCard>

            {/* Expandable Details */}
            <AnimatePresence>
              {detailsExpanded && (
                <>
                  {/* Market Overview */}
                  <motion.div
                    className="md:col-span-1"
                    initial={{ opacity: 0, height: 0, y: -12 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <GlassCard className="h-full">
                      <div className="flex items-center gap-2.5 mb-4">
                        <TrendingUp className="w-5 h-5 text-blue-400/70" />
                        <h2 className="text-base font-semibold text-white/75">
                          Обзор рынка
                        </h2>
                      </div>
                      <p className="text-sm text-white/40 leading-relaxed">
                        {result.marketOverview}
                      </p>
                    </GlassCard>
                  </motion.div>

                  {/* Pain Points */}
                  <motion.div
                    className="md:col-span-1"
                    initial={{ opacity: 0, height: 0, y: -12 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -12 }}
                    transition={{ duration: 0.4, delay: 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <GlassCard className="h-full">
                      <div className="flex items-center gap-2.5 mb-4">
                        <Zap className="w-5 h-5 text-yellow-400/70" />
                        <h2 className="text-base font-semibold text-white/75">
                          Боли клиентов
                        </h2>
                      </div>
                      <div className="space-y-3">
                        {result.painPoints.map((p, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="text-[10px] text-white/20 mt-1 tabular-nums shrink-0 w-6 text-right">
                              {p.severity}/10
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white/55 leading-snug">
                                {p.pain}
                              </p>
                              <p className="text-[11px] text-white/20 mt-0.5 truncate">
                                {p.source}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Death Reasons — full width */}
                  <motion.div
                    className="md:col-span-2"
                    initial={{ opacity: 0, height: 0, y: -12 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -12 }}
                    transition={{ duration: 0.4, delay: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <GlassCard>
                      <div className="flex items-center gap-2.5 mb-5">
                        <Skull className="w-5 h-5 text-red-400/70" />
                        <h2 className="text-base font-semibold text-white/75">
                          5 причин провала
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                        {result.deathReasons.map((r, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                            className={i === 4 ? "md:col-span-2 md:max-w-[50%]" : ""}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-white/65">
                                {i + 1}. {r.reason}
                              </span>
                              <span className="text-[11px] text-white/25 tabular-nums">
                                {r.severity}/10
                              </span>
                            </div>
                            <SeverityBar value={r.severity} />
                            <p className="text-xs text-white/35 mt-2 leading-relaxed">
                              {r.description}
                            </p>
                            <p className="text-[11px] text-white/20 mt-1 italic">
                              {r.evidence}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </GlassCard>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
