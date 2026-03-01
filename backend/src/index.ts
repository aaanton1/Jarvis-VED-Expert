import "dotenv/config";
import path from "path";

// Load .env from project root
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import fs from "fs";
import axios from "axios";
import prisma from "./utils/db";
import { ResearchEngine, ResearchProgress } from "./engine/research";

// ─── Salebot ────────────────────────────────────────────────────────────────
const SALEBOT_API_KEY = "f4f0c0dc0e5f22943e603d80539ee968";

async function sendMessage(client_id: string, text: string): Promise<void> {
  try {
    await axios.post(
      `https://chatter.salebot.pro/api/${SALEBOT_API_KEY}/send_message`,
      { client_id, message: text }
    );
    console.log("Сообщение отправлено юзеру:", client_id);
  } catch (e) {
    console.error("Ошибка отправки через Salebot API", e);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for SSE connections and research progress
const activeResearches = new Map<
  string,
  { progress: ResearchProgress[]; listeners: Set<express.Response> }
>();

// POST /webhook — Salebot incoming messages
app.post("/webhook", async (req, res) => {
  const { text, user_id } = req.body;

  if (!text || !user_id) {
    res.sendStatus(400);
    return;
  }

  const calculation =
    `✅ *Результат расчёта для: ${text}*\n\n` +
    `💰 Пошлина: 15%\n` +
    `📦 НДС: 20%\n\n` +
    `_Данные сохранены в систему._`;

  await sendMessage(String(user_id), calculation);

  console.log("Webhook lead:", { user_id, text });

  res.sendStatus(200);
});

// POST /api/research — start a new research
app.post("/api/research", async (req, res) => {
  const { keyword } = req.body;
  if (!keyword || typeof keyword !== "string") {
    res.status(400).json({ error: "keyword is required" });
    return;
  }

  // Create Idea in DB
  const idea = await prisma.idea.create({
    data: { keyword, status: "Researching" },
  });

  // Init SSE tracking
  activeResearches.set(idea.id, { progress: [], listeners: new Set() });

  // Run research in background
  const engine = new ResearchEngine();
  engine
    .run(keyword, (p) => {
      const entry = activeResearches.get(idea.id);
      if (entry) {
        entry.progress.push(p);
        for (const listener of entry.listeners) {
          listener.write(`data: ${JSON.stringify(p)}\n\n`);
        }
      }
    })
    .then(async (result) => {
      const status =
        result.report.criticalReport.verdict === "HIGH_RISK"
          ? "Rejected"
          : "Validated";

      await prisma.idea.update({
        where: { id: idea.id },
        data: {
          status,
          score: result.report.criticalReport.overallScore,
          reportPath: result.filepath,
        },
      });

      // Close SSE connections
      const entry = activeResearches.get(idea.id);
      if (entry) {
        const doneEvent = JSON.stringify({
          stage: "completed",
          message: "Готово",
          progress: 100,
          result: {
            verdict: result.report.criticalReport.verdict,
            score: result.report.criticalReport.overallScore,
            summary: result.report.criticalReport.summary,
            deathReasons: result.report.criticalReport.deathReasons,
            painPoints: result.report.trendReport.painPoints,
            marketOverview: result.report.trendReport.marketOverview,
          },
        });
        for (const listener of entry.listeners) {
          listener.write(`data: ${doneEvent}\n\n`);
          listener.end();
        }
      }
    })
    .catch(async (err) => {
      await prisma.idea.update({
        where: { id: idea.id },
        data: { status: "Rejected" },
      });
      const entry = activeResearches.get(idea.id);
      if (entry) {
        const errEvent = JSON.stringify({
          stage: "error",
          message: err.message ?? "Unknown error",
          progress: -1,
        });
        for (const listener of entry.listeners) {
          listener.write(`data: ${errEvent}\n\n`);
          listener.end();
        }
      }
    });

  res.json({ id: idea.id, status: "Researching" });
});

// GET /api/research/:id/stream — SSE stream
app.get("/api/research/:id/stream", (req, res) => {
  const { id } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const entry = activeResearches.get(id);
  if (!entry) {
    res.write(
      `data: ${JSON.stringify({ stage: "error", message: "Research not found", progress: -1 })}\n\n`
    );
    res.end();
    return;
  }

  // Send all past events
  for (const p of entry.progress) {
    res.write(`data: ${JSON.stringify(p)}\n\n`);
  }

  entry.listeners.add(res);

  req.on("close", () => {
    entry.listeners.delete(res);
  });
});

// GET /api/research/:id — get idea + full report
app.get("/api/research/:id", async (req, res) => {
  const idea = await prisma.idea.findUnique({
    where: { id: req.params.id },
  });

  if (!idea) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // If reportPath exists, include the full report
  let report = null;
  if (idea.reportPath) {
    try {
      const content = fs.readFileSync(idea.reportPath, "utf-8");
      report = JSON.parse(content);
    } catch {
      // Report file not found or invalid — ignore
    }
  }

  res.json({ ...idea, report });
});

// GET /api/ideas — list all ideas
app.get("/api/ideas", async (_req, res) => {
  const ideas = await prisma.idea.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(ideas);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`JARVIS Backend running on http://localhost:${PORT}`);
});
