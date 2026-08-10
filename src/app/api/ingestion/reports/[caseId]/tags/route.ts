import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createIngestionService } from "@/services/ingestion";

async function resolveSourceCase(sourceKey: string, caseId: string) {
  return prisma.case.findFirst({
    where: {
      sourceSystem: sourceKey,
      OR: [{ id: caseId }, { externalId: caseId }]
    },
    select: {
      id: true
    }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const ingestion = createIngestionService();
  const auth = await ingestion.authenticate(request.headers, "");

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  const { caseId } = await params;
  const feedbackCase = await resolveSourceCase(auth.source.key, caseId);

  if (!feedbackCase) {
    return NextResponse.json({ error: "Case was not found for this product source" }, { status: 404 });
  }

  let body: { tagIds?: unknown };
  try {
    body = (await request.json()) as { tagIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter((tagId): tagId is string => typeof tagId === "string") : [];

  if (tagIds.length === 0) {
    return NextResponse.json({ error: "At least one tag ID is required" }, { status: 400 });
  }

  const tags = await prisma.caseTag.findMany({
    where: {
      id: { in: tagIds },
      sourceId: auth.source.id,
      active: true
    },
    select: { id: true, name: true, color: true }
  });

  if (tags.length !== tagIds.length) {
    return NextResponse.json({ error: "One or more tags are not available for this product source" }, { status: 400 });
  }

  await prisma.$transaction(
    tags.map((tag) =>
      prisma.caseTagAssignment.upsert({
        where: {
          caseId_tagId: {
            caseId: feedbackCase.id,
            tagId: tag.id
          }
        },
        create: {
          caseId: feedbackCase.id,
          tagId: tag.id
        },
        update: {}
      })
    )
  );

  return NextResponse.json({ caseId, tags });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const ingestion = createIngestionService();
  const auth = await ingestion.authenticate(request.headers, "");

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  const { caseId } = await params;
  const feedbackCase = await resolveSourceCase(auth.source.key, caseId);

  if (!feedbackCase) {
    return NextResponse.json({ error: "Case was not found for this product source" }, { status: 404 });
  }

  const url = new URL(request.url);
  const tagId = url.searchParams.get("tagId")?.trim();

  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  const tag = await prisma.caseTag.findFirst({
    where: {
      id: tagId,
      sourceId: auth.source.id
    },
    select: { id: true }
  });

  if (!tag) {
    return NextResponse.json({ error: "Tag was not found for this product source" }, { status: 404 });
  }

  await prisma.caseTagAssignment.deleteMany({
    where: {
      caseId: feedbackCase.id,
      tagId
    }
  });

  return NextResponse.json({ caseId, removedTagId: tagId });
}
