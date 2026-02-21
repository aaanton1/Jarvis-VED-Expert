import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

/**
 * GET /api/research/[id]/stream — SSE-прокси
 * Проксирует SSE-стрим прогресса с Express backend.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const backendStream = await fetch(
    `${BACKEND_URL}/api/research/${id}/stream`,
    {
      headers: { Accept: "text/event-stream" },
    }
  );

  if (!backendStream.body) {
    return new Response(
      `data: ${JSON.stringify({ stage: "error", message: "No stream available", progress: -1 })}\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  return new Response(backendStream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
