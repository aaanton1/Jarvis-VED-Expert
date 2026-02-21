import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  TrendingUp,
  Zap,
  Skull,
  AlertTriangle,
} from "lucide-react";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

// ─── Types ───

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

interface FullReport {
  id: string;
  niche: string;
  createdAt: string;
  trendReport: {
    marketOverview: string;
    painPoints: PainPoint[];
    competitors: string[];
    estimatedMarketSize: string;
  };
  criticalReport: {
    verdict: string;
    overallScore: number;
    deathReasons: DeathReason[];
    summary: string;
  };
}

interface IdeaWithReport {
  id: string;
  keyword: string;
  status: string;
  score: number | null;
  createdAt: string;
  report: FullReport | null;
}

// ─── Status/Verdict translations ───

const STATUS_RU: Record<string, string> = {
  Draft: "Черновик",
  Researching: "Исследуется",
  Validated: "Одобрено",
  Rejected: "Отклонено",
};

const VERDICT_RU: Record<string, string> = {
  HIGH_RISK: "Высокий риск",
  MEDIUM_RISK: "Средний риск",
  LOW_RISK: "Низкий риск",
};

// ─── Helpers ───

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "HIGH_RISK")
    return <ShieldAlert className="w-10 h-10 text-red-400" />;
  if (verdict === "MEDIUM_RISK")
    return <ShieldQuestion className="w-10 h-10 text-yellow-400" />;
  return <ShieldCheck className="w-10 h-10 text-green-400" />;
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

function severityBarColor(pct: number) {
  if (pct > 70) return "bg-red-500";
  if (pct > 40) return "bg-yellow-500";
  return "bg-green-500";
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] p-6 ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Data fetching ───

async function getIdeaWithReport(id: string): Promise<IdeaWithReport | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/research/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Page ───

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getIdeaWithReport(id);

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400/50 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white/80 mb-2">
          Исследование не найдено
        </h1>
        <p className="text-white/30 mb-6">
          Возможно, оно было удалено или ID неверный.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-blue-400/70 hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" /> Вернуться на главную
        </Link>
      </div>
    );
  }

  const report = data.report;
  const verdict = report?.criticalReport?.verdict ?? "HIGH_RISK";
  const score = data.score ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Назад к списку
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white/90 mb-2">
          {data.keyword}
        </h1>
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
              data.status === "Rejected"
                ? "bg-red-500/20 text-red-400"
                : data.status === "Validated"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {STATUS_RU[data.status] ?? data.status}
          </span>
          <span className="text-xs text-white/20">
            {new Date(data.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {!report ? (
        <GlassCard>
          <p className="text-white/40 text-sm">
            Полный отчёт недоступен. Возможно, файл был перемещён или исследование ещё не завершено.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Verdict — full width */}
          <GlassCard className={`md:col-span-2 ${verdictBg(verdict)}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <VerdictIcon verdict={verdict} />
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-semibold text-white/85">
                      Вердикт
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        verdict === "HIGH_RISK"
                          ? "bg-red-500/20 text-red-400"
                          : verdict === "MEDIUM_RISK"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {VERDICT_RU[verdict] ?? verdict}
                    </span>
                  </div>
                  <p className="text-sm text-white/40 max-w-2xl">
                    {report.criticalReport.summary}
                  </p>
                </div>
              </div>
              <span
                className={`text-5xl font-bold tabular-nums ${verdictColor(verdict)}`}
              >
                {score}
              </span>
            </div>
          </GlassCard>

          {/* Market Overview */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-400/70" />
              <h2 className="text-base font-semibold text-white/75">
                Обзор рынка
              </h2>
            </div>
            <p className="text-sm text-white/40 leading-relaxed mb-4">
              {report.trendReport.marketOverview}
            </p>
            <div className="border-t border-white/[0.06] pt-3 mt-3">
              <p className="text-[11px] text-white/25 mb-1">Размер рынка</p>
              <p className="text-sm text-white/50">
                {report.trendReport.estimatedMarketSize}
              </p>
            </div>
            {report.trendReport.competitors.length > 0 && (
              <div className="border-t border-white/[0.06] pt-3 mt-3">
                <p className="text-[11px] text-white/25 mb-2">Конкуренты</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.trendReport.competitors.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.05] text-white/40"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Pain Points */}
          <GlassCard>
            <div className="flex items-center gap-2.5 mb-4">
              <Zap className="w-5 h-5 text-yellow-400/70" />
              <h2 className="text-base font-semibold text-white/75">
                Боли клиентов ({report.trendReport.painPoints.length})
              </h2>
            </div>
            <div className="space-y-3">
              {report.trendReport.painPoints.map((p, i) => (
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
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full ${severityBarColor((p.severity / 10) * 100)}`}
                        style={{ width: `${(p.severity / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Death Reasons — full width */}
          <GlassCard className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <Skull className="w-5 h-5 text-red-400/70" />
              <h2 className="text-base font-semibold text-white/75">
                Критические факторы провала
              </h2>
            </div>
            <div className="space-y-6">
              {report.criticalReport.deathReasons.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.04] p-4"
                  style={{ background: "rgba(255,255,255,0.01)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/70">
                      {i + 1}. {r.reason}
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        r.severity >= 9
                          ? "text-red-400"
                          : r.severity >= 7
                            ? "text-yellow-400"
                            : "text-green-400"
                      }`}
                    >
                      {r.severity}/10
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full ${severityBarColor((r.severity / 10) * 100)}`}
                      style={{ width: `${(r.severity / 10) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-white/45 leading-relaxed mb-2">
                    {r.description}
                  </p>
                  <p className="text-xs text-white/25 italic leading-relaxed">
                    {r.evidence}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
