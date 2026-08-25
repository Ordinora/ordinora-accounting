import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "alive", service: "ordinora", requestId: randomUUID(), timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
