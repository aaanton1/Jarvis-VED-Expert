import Link from "next/link";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ArrowRight, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

interface Idea {
  id: string;
  keyword: string;
  status: string;
  score: number | null;
  createdAt: string;
}

const STATUS_RU: Record<string, string> = {
  Draft: "Черновик",
  Researching: "Исследуется",
  Validated: "Одобрено",
  Rejected: "Отклонено",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Draft: { bg: "bg-white/10", text: "text-white/50" },
    Researching: { bg: "bg-blue-500/20", text: "text-blue-400" },
    Validated: { bg: "bg-green-500/20", text: "text-green-400" },
    Rejected: { bg: "bg-red-500/20", text: "text-red-400" },
  };
  const s = map[status] ?? map.Draft;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      {STATUS_RU[status] ?? status}
    </span>
  );
}

function VerdictIcon({ score }: { score: number | null }) {
  if (score === null) return <ShieldQuestion className="w-6 h-6 text-white/20" />;
  if (score <= 33) return <ShieldAlert className="w-6 h-6 text-red-400" />;
  if (score <= 66) return <ShieldQuestion className="w-6 h-6 text-yellow-400" />;
  return <ShieldCheck className="w-6 h-6 text-green-400" />;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-white/20";
  if (score <= 33) return "text-red-400";
  if (score <= 66) return "text-yellow-400";
  return "text-green-400";
}

async function getIdeas(): Promise<Idea[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/ideas`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const ideas = await getIdeas();

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-14">
        <h1 className="text-5xl font-bold tracking-tight text-white/90 mb-4">
          JARVIS
        </h1>
        <p className="text-lg text-white/35 max-w-lg mx-auto">
          Автономный конвейер валидации бизнес-идей
        </p>
      </div>

      {ideas.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-white/50">
              Исследованные идеи ({ideas.length})
            </h2>
            <Link
              href="/research-center"
              className="flex items-center gap-1.5 text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
            >
              Новое исследование <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {ideas.map((idea) => (
            <Link
              key={idea.id}
              href={`/research/${idea.id}`}
              className="block rounded-2xl border border-white/[0.06] p-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-200 group"
              style={{
                background: "rgba(255,255,255,0.02)",
                backdropFilter: "blur(40px)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <VerdictIcon score={idea.score} />
                  <div>
                    <p className="text-sm font-medium text-white/75 mb-1">
                      {idea.keyword}
                    </p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={idea.status} />
                      <span className="text-[10px] text-white/20">
                        {new Date(idea.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold tabular-nums ${scoreColor(idea.score)}`}>
                    {idea.score !== null ? idea.score : "\u2014"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-white/25 mb-6">Пока нет исследованных идей.</p>
          <Link
            href="/research-center"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.14] transition-all"
          >
            Запустить первое исследование <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
