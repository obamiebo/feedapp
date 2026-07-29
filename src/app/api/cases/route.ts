import { NextResponse } from "next/server";
import { caseStatuses, priorities } from "@/domain/constants";
import type { CaseStatus, Priority } from "@/domain/types";
import { canCreateCase, canEnterApplication } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { createCaseSchema } from "@/lib/validation";
import type { CaseListQuery, CaseSlaState } from "@/repositories/cases";
import { createCaseService } from "@/services/cases";

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseFilters(searchParams: URLSearchParams): CaseListQuery {
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const slaState = searchParams.get("slaState") ?? undefined;

  return {
    status: caseStatuses.includes(status as CaseStatus) ? (status as CaseStatus) : undefined,
    priority: priorities.includes(priority as Priority) ? (priority as Priority) : undefined,
    departmentId: searchParams.get("departmentId") || undefined,
    assigneeId: searchParams.get("assigneeId") || undefined,
    sourceSystem: searchParams.get("sourceSystem") || undefined,
    slaState: ["on-track", "at-risk", "breached"].includes(slaState ?? "")
      ? (slaState as CaseSlaState)
      : undefined,
    search: searchParams.get("search") || undefined,
    page: positiveInteger(searchParams.get("page")),
    pageSize: positiveInteger(searchParams.get("pageSize"))
  };
}

function passwordChangeRequiredResponse() {
  return NextResponse.json({ error: "Password change required" }, { status: 403 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentUser = await resolveCurrentUser();

  if (!currentUser || !canEnterApplication(currentUser)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (currentUser.passwordMustChange) {
    return passwordChangeRequiredResponse();
  }

  const page = await createCaseService().listCasesPageForUser(currentUser, parseFilters(url.searchParams));
  return NextResponse.json({
    cases: page.items,
    pagination: {
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      pageCount: page.pageCount
    }
  });
}

export async function POST(request: Request) {
  const currentUser = await resolveCurrentUser();

  if (!currentUser || !canCreateCase(currentUser)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (currentUser.passwordMustChange) {
    return passwordChangeRequiredResponse();
  }

  const body = await request.json();
  const parsed = createCaseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid case payload", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const created = await createCaseService().createCaseForUser(parsed.data, currentUser);

    return NextResponse.json({ case: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Current user cannot")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    throw error;
  }
}
