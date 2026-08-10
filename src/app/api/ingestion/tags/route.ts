import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createIngestionService } from "@/services/ingestion";

function serializeTag(tag: { id: string; name: string; color: string; description: string | null; active: boolean }) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    description: tag.description,
    active: tag.active
  };
}

export async function GET(request: Request) {
  const ingestion = createIngestionService();
  const auth = await ingestion.authenticate(request.headers, "");

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  const tags = await prisma.caseTag.findMany({
    where: {
      sourceId: auth.source.id,
      active: true
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      active: true
    }
  });

  return NextResponse.json({ tags: tags.map(serializeTag) });
}

export async function POST(request: Request) {
  const ingestion = createIngestionService();
  const auth = await ingestion.authenticate(request.headers, "");

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  let body: { name?: unknown; color?: unknown; description?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; color?: unknown; description?: unknown };
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const color =
    typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color.trim()) ? body.color.trim() : "#244f89";
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;

  if (name.length < 2) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }

  const tag = await prisma.caseTag.upsert({
    where: {
      sourceId_name: {
        sourceId: auth.source.id,
        name
      }
    },
    create: {
      sourceId: auth.source.id,
      name,
      color,
      description
    },
    update: {
      color,
      description,
      active: true
    },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      active: true
    }
  });

  return NextResponse.json({ tag: serializeTag(tag) }, { status: 201 });
}
