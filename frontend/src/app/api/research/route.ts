import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

/**
 * POST /api/research — запуск исследования
 * Проксирует запрос на Express backend, скрывает его адрес от клиента.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch(`${BACKEND_URL}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

/**
 * GET /api/research — список всех идей
 */
export async function GET() {
  const response = await fetch(`${BACKEND_URL}/api/ideas`);
  const data = await response.json();
  return NextResponse.json(data);
}
