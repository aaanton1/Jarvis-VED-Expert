import fs from "fs";
import path from "path";
import { TrendReport } from "../agents/trend-scout";
import { CriticalReport } from "../agents/devil-advocate";

export interface FullReport {
  id: string;
  niche: string;
  createdAt: string;
  trendReport: TrendReport;
  criticalReport: CriticalReport;
}

const DATA_DIR = path.resolve(__dirname, "../../../data/research");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export function saveReport(report: FullReport): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const filename = `${slugify(report.niche)}-${Date.now()}.json`;
  const filepath = path.join(DATA_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");

  return filepath;
}
