import { Bot, CheckCircle2, ClipboardList, History, KeyRound, MessageSquare, Send, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, priorityTone, slaLabel, slaTone, statusTone } from "@/components/status-badge";
import { caseStatuses } from "@/domain/constants";
import type { CaseStatus } from "@/domain/types";
import {
  canAddInternalNote,
  canEnterApplication,
  canApproveCustomerReply,
  canAssignCase,
  canRequestCustomerReplyApproval,
  canTransitionCase
} from "@/lib/access-control";
import { appRedirectLocation } from "@/lib/public-url";
import { resolveCurrentUser } from "@/lib/current-user";
import { getSessionToken } from "@/lib/session-cookie";
import { isSlaAtRisk, isSlaBreached } from "@/lib/sla";
import { customerReplyApprovalSchema, internalNoteSchema } from "@/lib/validation";
import { getAllowedTransitions } from "@/lib/workflow";
import { createPrismaUserRepository } from "@/repositories/users";
import { buildCaseTimeline } from "@/services/case-timeline";
import { createCaseTagService } from "@/services/case-tags";
import { createCaseService } from "@/services/cases";
import {
  createCustomerRecommendationService,
  draftRecommendationMessage,
  handledRecommendationIdsFromAuditLogs
} from "@/services/customer-recommendations";
import { suggestCustomerReply } from "@/services/customer-reply-suggestions";
import { createAgentBotService, isFeedbackAgentEnabled } from "@/services/agent-bot";

export const dynamic = "force-dynamic";

const VISIBLE_TIMELINE_COUNT = 6;
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted";

function recommendationActionFromForm(formData: FormData) {
  const recommendationId = String(formData.get("recommendationId") ?? "");
  const productName = String(formData.get("recommendationProductName") ?? "");

  return recommendationId && productName ? { recommendationId, productName } : null;
}

function approvalKind(approvalId: string, auditLogs: Array<{ action: string; metadata: unknown }>) {
  const fromRecommendation = auditLogs.some((auditLog) => {
    if (auditLog.action !== "case.recommendation_message_review_requested") {
      return false;
    }

    const metadata = auditLog.metadata as { approvalId?: unknown } | null;
    return metadata?.approvalId === approvalId;
  });

  return fromRecommendation
    ? { label: "ITC Product Recommendation", tone: "warning" as const }
    : { label: "Customer reply", tone: "neutral" as const };
}

function firstParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function caseDetailHref(caseId: string, sourceSystem?: string, embedMode = false): Route {
  const params = new URLSearchParams();

  if (sourceSystem) {
    params.set("sourceSystem", sourceSystem);
  }

  if (embedMode) {
    params.set("entryMode", "embed");
  }

  const query = params.toString();
  return `/cases/${caseId}${query ? `?${query}` : ""}` as Route;
}

function dashboardHref(sourceSystem?: string, embedMode = false): Route {
  const params = new URLSearchParams();

  if (sourceSystem) {
    params.set("sourceSystem", sourceSystem);
  }

  if (embedMode) {
    params.set("entryMode", "embed");
  }

  const query = params.toString();
  return `/${query ? `?${query}` : ""}` as Route;
}

function redirectToCaseFromForm(formData: FormData, caseId: string) {
  const sourceSystem = String(formData.get("sourceSystem") ?? "") || undefined;
  const embedMode = formData.get("entryMode") === "embed";
  redirect(appRedirectLocation(caseDetailHref(caseId, sourceSystem, embedMode)) as Parameters<typeof redirect>[0]);
}

async function transitionCaseAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const caseId = String(formData.get("caseId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!currentUser) {
    redirect("/login");
  }

  if (!caseId || !caseStatuses.includes(status as CaseStatus)) {
    throw new Error("Invalid status transition request");
  }

  await createCaseService().transitionCaseForUser(caseId, status as CaseStatus, currentUser);
  revalidatePath("/");
  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function assignCaseAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const caseId = String(formData.get("caseId") ?? "");
  const assigneeValue = String(formData.get("assigneeId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const assigneeId = assigneeValue === "unassigned" ? null : assigneeValue;

  if (!caseId || !departmentId) {
    throw new Error("Invalid assignment request");
  }

  if (!currentUser) {
    redirect("/login");
  }

  await createCaseService().assignCaseForUser(caseId, assigneeId, departmentId, currentUser);
  revalidatePath("/");
  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function addInternalNoteAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const parsed = internalNoteSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    body: String(formData.get("body") ?? "").trim()
  });

  if (!parsed.success) {
    throw new Error("Invalid internal note payload");
  }

  if (!currentUser) {
    redirect("/login");
  }

  await createCaseService().addInternalNoteForUser(parsed.data.caseId, parsed.data.body, currentUser);
  revalidatePath(`/cases/${parsed.data.caseId}`);
  redirectToCaseFromForm(formData, parsed.data.caseId);
}

async function requestCustomerReplyApprovalAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const parsed = customerReplyApprovalSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    channel: String(formData.get("channel") ?? ""),
    draftBody: String(formData.get("draftBody") ?? "").trim()
  });

  if (!parsed.success) {
    throw new Error("Invalid customer reply draft payload");
  }

  if (!currentUser) {
    redirect("/login");
  }

  const approval = await createCaseService().requestCustomerReplyApprovalForUser(
    {
      caseId: parsed.data.caseId,
      channel: parsed.data.channel as "Email" | "SMS",
      draftBody: parsed.data.draftBody
    },
    currentUser
  );

  const recommendation = recommendationActionFromForm(formData);

  if (recommendation) {
    await createCustomerRecommendationService().trackMessageActionForUser(
      {
        caseId: parsed.data.caseId,
        recommendationId: recommendation.recommendationId,
        productName: recommendation.productName,
        action: "review_requested",
        approvalId: approval.id
      },
      currentUser
    );
  }

  revalidatePath(`/cases/${parsed.data.caseId}`);
  redirectToCaseFromForm(formData, parsed.data.caseId);
}

async function generateBotReplyDraftAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const sessionToken = await getSessionToken();
  const caseId = String(formData.get("caseId") ?? "");
  const channel = String(formData.get("channel") ?? "");

  if (!currentUser || !sessionToken) {
    redirect("/login");
  }

  if (!caseId || (channel !== "Email" && channel !== "SMS")) {
    throw new Error("Invalid bot reply generation request");
  }

  await createAgentBotService().generateCustomerReplyDraftForUser(
    {
      caseId,
      channel,
      userSessionToken: sessionToken
    },
    currentUser
  );

  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function sendCustomerReplyAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const parsed = customerReplyApprovalSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    channel: String(formData.get("channel") ?? ""),
    draftBody: String(formData.get("draftBody") ?? "").trim()
  });

  if (!parsed.success) {
    throw new Error("Invalid customer reply payload");
  }

  if (!currentUser) {
    redirect("/login");
  }

  await createCaseService().sendCustomerReplyForUser(
    {
      caseId: parsed.data.caseId,
      channel: parsed.data.channel as "Email" | "SMS",
      draftBody: parsed.data.draftBody
    },
    currentUser
  );

  const recommendation = recommendationActionFromForm(formData);

  if (recommendation) {
    await createCustomerRecommendationService().trackMessageActionForUser(
      {
        caseId: parsed.data.caseId,
        recommendationId: recommendation.recommendationId,
        productName: recommendation.productName,
        action: "sent"
      },
      currentUser
    );
  }

  revalidatePath(`/cases/${parsed.data.caseId}`);
  redirectToCaseFromForm(formData, parsed.data.caseId);
}

async function dismissRecommendationAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const caseId = String(formData.get("caseId") ?? "");
  const recommendation = recommendationActionFromForm(formData);

  if (!currentUser) {
    redirect("/login");
  }

  if (!caseId || !recommendation) {
    throw new Error("Invalid recommendation dismissal request");
  }

  await createCustomerRecommendationService().dismissForUser(
    {
      caseId,
      recommendationId: recommendation.recommendationId,
      productName: recommendation.productName
    },
    currentUser
  );
  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function dismissCustomerReplySuggestionAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const caseId = String(formData.get("caseId") ?? "");

  if (!currentUser) {
    redirect("/login");
  }

  if (!caseId) {
    throw new Error("Invalid customer reply suggestion dismissal request");
  }

  await createCaseService().dismissCustomerReplySuggestionForUser(caseId, currentUser);
  revalidatePath("/");
  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function approveCustomerReplyAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const approvalId = String(formData.get("approvalId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const reviewedBody = String(formData.get("reviewedBody") ?? "").trim();

  if (!currentUser) {
    redirect("/login");
  }

  if (!approvalId) {
    throw new Error("Invalid approval request");
  }

  await createCaseService().approveCustomerReplyForUser(approvalId, currentUser, reviewedBody || undefined);
  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function rejectCustomerReplyAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const approvalId = String(formData.get("approvalId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");

  if (!currentUser) {
    redirect("/login");
  }

  if (!approvalId) {
    throw new Error("Invalid approval request");
  }

  await createCaseService().rejectCustomerReplyForUser(approvalId, currentUser);
  revalidatePath(`/cases/${caseId}`);
  redirectToCaseFromForm(formData, caseId);
}

async function assignCaseTagAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const caseId = String(formData.get("caseId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");

  if (!currentUser) {
    redirect("/login");
  }

  if (!caseId || !tagId) {
    throw new Error("Invalid case tag assignment");
  }

  await createCaseTagService().assignTagForUser({ caseId, tagId }, currentUser);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
  redirectToCaseFromForm(formData, caseId);
}

async function removeCaseTagAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const caseId = String(formData.get("caseId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");

  if (!currentUser) {
    redirect("/login");
  }

  if (!caseId || !tagId) {
    throw new Error("Invalid case tag removal");
  }

  await createCaseTagService().removeTagForUser({ caseId, tagId }, currentUser);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
  redirectToCaseFromForm(formData, caseId);
}

function formatDate(value?: Date | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function CaseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caseId } = await params;
  const resolvedSearchParams = await searchParams;
  const sourceSystemParam = firstParam(resolvedSearchParams, "sourceSystem") || undefined;
  const embedMode = firstParam(resolvedSearchParams, "entryMode") === "embed";
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.passwordMustChange) {
    redirect("/change-password");
  }

  if (!canEnterApplication(currentUser)) {
    return (
      <AppShell active="cases" currentUser={currentUser} entryMode={embedMode ? "embed" : undefined} sourceSystem={sourceSystemParam}>
        <PageHeader
          breadcrumbHref={dashboardHref(sourceSystemParam, embedMode)}
          breadcrumbLabel="Back to cases"
          eyebrow="Access required"
          title="Case unavailable"
        />
        <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
          <EmptyState icon={ShieldCheck} message="This user is not provisioned for application access." />
        </section>
      </AppShell>
    );
  }

  const caseService = createCaseService();
  const caseAccess = await caseService.getCaseDetailAccessForUser(caseId, currentUser);

  if (caseAccess.status === "not-found") {
    notFound();
  }

  if (caseAccess.status === "forbidden") {
    return (
      <AppShell active="cases" currentUser={currentUser} entryMode={embedMode ? "embed" : undefined} sourceSystem={sourceSystemParam}>
        <PageHeader
          breadcrumbHref={dashboardHref(sourceSystemParam, embedMode)}
          breadcrumbLabel="Back to dashboard"
          eyebrow="Case access"
          title="Case access unavailable"
          subtitle={caseAccess.caseDetail.id}
        />
        <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-warning-bg text-warning">
              <KeyRound size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">Operational case access is required</h2>
              <p className="mt-1 text-sm text-muted">
                This account can manage platform settings, but it does not have an operational role and product access for this case.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className={secondaryButtonClass} href="/settings/team">
                  View access
                </Link>
                <Link className={primaryButtonClass} href={dashboardHref(sourceSystemParam, embedMode)}>
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const caseDetail = caseAccess.caseDetail;
  const assignedTags = caseDetail.tags ?? [];
  const canShowProductRecommendations = caseDetail.status === "Resolved" || caseDetail.status === "Closed";

  const recommendationService = createCustomerRecommendationService();
  const [users, recommendations, productTags] = await Promise.all([
    createPrismaUserRepository().listAssignableUsersByProductSourceKey(caseDetail.sourceSystem),
    canShowProductRecommendations ? recommendationService.listForCase(caseDetail, currentUser) : Promise.resolve([]),
    createCaseTagService().listTagsForSourceForUser(caseDetail.sourceSystem, currentUser).catch(() => [])
  ]);

  const allowedTransitions = getAllowedTransitions(caseDetail.status);
  const permittedTransitions = currentUser
    ? allowedTransitions.filter((status) => canTransitionCase(currentUser, caseDetail, status))
    : [];
  const sla = { breached: isSlaBreached(caseDetail), atRisk: isSlaAtRisk(caseDetail) };
  const timeline = buildCaseTimeline(caseDetail);
  const visibleTimeline = timeline.slice(0, VISIBLE_TIMELINE_COUNT);
  const olderTimeline = timeline.slice(VISIBLE_TIMELINE_COUNT);
  const conversationMessages = caseDetail.messages
    .filter((message) => message.channel !== "Internal Note")
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const canAssign = currentUser ? canAssignCase(currentUser, caseDetail) : false;
  const unassignedProductTags = productTags.filter((tag) => !assignedTags.some((assigned) => assigned.id === tag.id));
  const canAddNote = currentUser ? canAddInternalNote(currentUser, caseDetail) : false;
  const canRequestReplyApproval = currentUser ? canRequestCustomerReplyApproval(currentUser, caseDetail) : false;
  const canSendCustomerReply = currentUser ? canApproveCustomerReply(currentUser, caseDetail) : false;
  const pendingApprovals = caseDetail.approvals.filter((approval) => approval.status === "Pending");
  const actionableApprovals = pendingApprovals.filter(
    (approval) => approval.requestedReviewerId === currentUser.id && canApproveCustomerReply(currentUser, caseDetail)
  );
  const inProgressApprovals = pendingApprovals.filter((approval) => !actionableApprovals.includes(approval));
  const customerReplySuggestion =
    currentUser && canRequestReplyApproval ? await caseService.getCustomerReplySuggestionForUser(caseDetail.id, currentUser) : null;
  const customerReplyApprovalRoute =
    currentUser && canRequestReplyApproval ? await caseService.getCustomerReplyApprovalRouteForUser(caseDetail.id, currentUser) : null;
  const canGenerateBotReply = isFeedbackAgentEnabled() && canRequestReplyApproval && Boolean(customerReplyApprovalRoute);
  const suggestedReply = customerReplySuggestion
    ? suggestCustomerReply(caseDetail, { staleFollowUp: customerReplySuggestion.staleFollowUp })
    : "";
  const handledRecommendationIds = handledRecommendationIdsFromAuditLogs(caseDetail.auditLogs);
  const visibleRecommendations = canShowProductRecommendations
    ? recommendations.filter((recommendation) => !handledRecommendationIds.has(recommendation.id))
    : [];

  const inputClass =
    "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
  const cardClass = "rounded-lg border border-[#b8c9df] bg-panel shadow-sm";
  const cardHeaderClass = "flex items-center gap-2 border-b border-[#c3d1e3] px-5 py-4";
  const cardHeaderBetweenClass = "flex items-center justify-between border-b border-[#c3d1e3] px-5 py-4";
  const nestedCardClass = "rounded-md border border-[#c3d1e3] p-3";

  return (
    <AppShell active="cases" currentUser={currentUser} entryMode={embedMode ? "embed" : undefined} sourceSystem={sourceSystemParam ?? caseDetail.sourceSystem}>
      <PageHeader
        breadcrumbHref={dashboardHref(sourceSystemParam ?? caseDetail.sourceSystem, embedMode)}
        breadcrumbLabel="Back to cases"
        eyebrow={caseDetail.sourceSystem}
        title={caseDetail.title}
        subtitle={`${caseDetail.id}${caseDetail.externalId ? ` · ${caseDetail.externalId}` : ""}`}
        actions={
          <>
            <StatusBadge label={caseDetail.priority} tone={priorityTone(caseDetail.priority)} />
            <StatusBadge label={slaLabel(sla)} tone={slaTone(sla)} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <section className={cardClass}>
            <div className={cardHeaderBetweenClass}>
              <h2 className="text-sm font-semibold text-ink">Case summary</h2>
              <StatusBadge label={caseDetail.status} tone={statusTone(caseDetail.status)} />
            </div>
            <div className="p-5">
              <p className="text-sm text-ink">{caseDetail.description}</p>
              <div className="my-5 border-t border-[#aebdd0]" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="sm:col-span-2 xl:col-span-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">Tags</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignedTags.length > 0 ? (
                      assignedTags.map((tag) => (
                        <form key={tag.id} action={removeCaseTagAction}>
                          <input name="caseId" type="hidden" value={caseDetail.id} />
                          <input name="tagId" type="hidden" value={tag.id} />
                          <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                          {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                          <button
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                            type="submit"
                            title="Remove tag"
                          >
                            {tag.name}
                            <XCircle size={12} aria-hidden="true" />
                          </button>
                        </form>
                      ))
                    ) : (
                      <span className="text-sm font-medium text-ink">No tags</span>
                    )}
                  </div>
                  {unassignedProductTags.length > 0 ? (
                    <form action={assignCaseTagAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
                      <input name="caseId" type="hidden" value={caseDetail.id} />
                      <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                      {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                      <select name="tagId" className={inputClass} aria-label="Add case tag" required>
                        {unassignedProductTags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="inline-flex items-center justify-center rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-panel-muted"
                        type="submit"
                      >
                        Add
                      </button>
                    </form>
                  ) : null}
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">Assignee</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
                    {caseDetail.assigneeName ? <Avatar name={caseDetail.assigneeName} size={20} /> : null}
                    {caseDetail.assigneeName ?? "Unassigned"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">SLA deadline</div>
                  <div className="mt-1 text-sm font-medium text-ink">{formatDate(caseDetail.slaDeadlineAt)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">Updated</div>
                  <div className="mt-1 text-sm font-medium text-ink">{formatDate(caseDetail.updatedAt)}</div>
                </div>
              </div>
            </div>
          </section>

          {actionableApprovals.length > 0 ? (
            <section className="rounded-lg border-2 border-critical bg-panel shadow-md">
              <div className="flex items-center gap-2 border-b border-critical-bg bg-critical-bg/40 px-5 py-4">
                <ShieldCheck size={18} className="text-critical" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Pending approvals</h2>
                <span className="ml-auto rounded-full bg-critical px-2 py-0.5 text-xs font-medium text-white">
                  {actionableApprovals.length} waiting
                </span>
              </div>
              <div className="flex flex-col divide-y divide-line">
                {actionableApprovals.map((approval) => {
                  const kind = approvalKind(approval.id, caseDetail.auditLogs);

                  return (
                    <div key={approval.id} className="flex flex-col gap-3 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={approval.channel} tone="info" />
                        <StatusBadge label={kind.label} tone={kind.tone} />
                        <span className="ml-auto whitespace-nowrap text-xs text-muted">Requested {formatDate(approval.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted">
                        Routed to {approval.requestedReviewerName ?? "eligible reviewers"}
                      </div>
                      <form className="flex flex-col gap-3">
                        <input name="approvalId" type="hidden" value={approval.id} />
                        <input name="caseId" type="hidden" value={caseDetail.id} />
                        <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                        {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                        <textarea
                          name="reviewedBody"
                          defaultValue={approval.draftBody}
                          rows={4}
                          className={inputClass}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button className={primaryButtonClass} formAction={approveCustomerReplyAction} type="submit">
                            <CheckCircle2 size={15} /> Approve & send
                          </button>
                          <button className={secondaryButtonClass} formAction={rejectCustomerReplyAction} type="submit">
                            <XCircle size={15} /> Decline
                          </button>
                        </div>
                      </form>
                  </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {inProgressApprovals.length > 0 ? (
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <ShieldCheck size={18} className="text-muted" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Approval in progress</h2>
                <span className="ml-auto rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
                  {inProgressApprovals.length} routed
                </span>
              </div>
              <div className="flex flex-col divide-y divide-line">
                {inProgressApprovals.map((approval) => {
                  const kind = approvalKind(approval.id, caseDetail.auditLogs);

                  return (
                    <div key={approval.id} className="flex flex-col gap-3 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={approval.channel} tone="info" />
                        <StatusBadge label={kind.label} tone={kind.tone} />
                        <span className="ml-auto whitespace-nowrap text-xs text-muted">Requested {formatDate(approval.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted">
                        Routed to {approval.requestedReviewerName ?? "configured product manager"}
                      </div>
                      <p className="rounded-md border border-line bg-panel-subtle px-3 py-2 text-sm text-muted">
                        {approval.draftBody}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {visibleRecommendations.length > 0 ? (
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <Sparkles size={18} className="text-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">ITC Product Recommendation</h2>
                <span className="ml-auto text-xs text-muted">Internal only</span>
              </div>
              <div className="flex flex-col divide-y divide-line">
                {visibleRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="flex flex-col gap-4 p-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-ink">{recommendation.productName}</strong>
                        <StatusBadge label={`${Math.round(recommendation.confidence * 100)}% confidence`} tone="info" />
                      </div>
                      <p className="text-sm text-muted">{recommendation.reason}</p>
                      <span className="text-xs text-muted">
                        Matched by {recommendation.analyticsCustomer.type}: {recommendation.analyticsCustomer.value}
                      </span>
                    </div>

                    {canRequestReplyApproval && currentUser ? (
                      <form className="flex flex-col gap-3">
                        <input name="caseId" type="hidden" value={caseDetail.id} />
                        <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                        {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                        <input name="recommendationId" type="hidden" value={recommendation.id} />
                        <input name="recommendationProductName" type="hidden" value={recommendation.productName} />
                        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={`recommendation-channel-${recommendation.id}`}>
                          Channel
                          <select
                            id={`recommendation-channel-${recommendation.id}`}
                            name="channel"
                            defaultValue="Email"
                            className={inputClass}
                          >
                            <option value="Email">Email</option>
                            <option value="SMS">SMS</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={`recommendation-draft-${recommendation.id}`}>
                          Review and edit customer message
                          <textarea
                            id={`recommendation-draft-${recommendation.id}`}
                            name="draftBody"
                            minLength={3}
                            defaultValue={draftRecommendationMessage(recommendation, caseDetail)}
                            rows={5}
                            required
                            className={inputClass}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {canSendCustomerReply ? (
                            <button className={primaryButtonClass} formAction={sendCustomerReplyAction} type="submit">
                              Send message
                            </button>
                          ) : customerReplyApprovalRoute ? (
                            <button className={primaryButtonClass} formAction={requestCustomerReplyApprovalAction} type="submit">
                              Submit for approval
                            </button>
                          ) : (
                            <button className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} disabled type="submit">
                              Submit for approval
                            </button>
                          )}
                          <button className={secondaryButtonClass} formAction={dismissRecommendationAction} formNoValidate type="submit">
                            Dismiss
                          </button>
                        </div>
                        {!canSendCustomerReply && !customerReplyApprovalRoute ? (
                          <span className="w-fit rounded-full border border-warning-bg bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                            No product manager reviewer configured
                          </span>
                        ) : null}
                      </form>
                    ) : (
                      <p className="rounded-md border border-line bg-panel-subtle px-3 py-2 text-sm text-muted">
                        This user can view the recommendation but cannot draft customer-facing messages for this case.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {customerReplySuggestion ? (
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <Send size={18} className="text-muted" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">
                  {customerReplySuggestion.staleFollowUp ? "Suggested customer follow-up" : "Suggested customer reply"}
                </h2>
              </div>
              <div className="p-5">
                {canRequestReplyApproval && currentUser ? (
                  <form className="flex flex-col gap-3">
                    <input name="caseId" type="hidden" value={caseDetail.id} />
                    <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                    {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="channel">
                      Channel
                      <select id="channel" name="channel" defaultValue="Email" className={inputClass}>
                        <option value="Email">Email</option>
                        <option value="SMS">SMS</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="draftBody">
                      Review and edit suggestion
                      <textarea
                        id="draftBody"
                        name="draftBody"
                        minLength={3}
                        defaultValue={suggestedReply}
                        placeholder="Review the suggested customer-facing response..."
                        rows={5}
                        required
                        className={inputClass}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {canSendCustomerReply ? (
                        <button className={primaryButtonClass} formAction={sendCustomerReplyAction} type="submit">
                          Send update
                        </button>
                      ) : customerReplyApprovalRoute ? (
                        <button className={primaryButtonClass} formAction={requestCustomerReplyApprovalAction} type="submit">
                          Submit for approval
                        </button>
                      ) : (
                        <button className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} disabled type="submit">
                          Submit for approval
                        </button>
                      )}
                      <button className={secondaryButtonClass} formAction={dismissCustomerReplySuggestionAction} formNoValidate type="submit">
                        Decline
                      </button>
                    </div>
                    {!canSendCustomerReply && !customerReplyApprovalRoute ? (
                      <span className="w-fit rounded-full border border-warning-bg bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                        No product manager reviewer configured
                      </span>
                    ) : null}
                  </form>
                ) : (
                  <p className="text-sm text-muted">This user cannot review customer reply suggestions for this case.</p>
                )}
              </div>
            </section>
          ) : null}

          {canGenerateBotReply ? (
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <Bot size={18} className="text-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Bot reply draft</h2>
                <span className="ml-auto text-xs text-muted">Draft only</span>
              </div>
              <form action={generateBotReplyDraftAction} className="flex flex-col gap-3 p-5">
                <input name="caseId" type="hidden" value={caseDetail.id} />
                <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="bot-channel">
                  Channel
                  <select id="bot-channel" name="channel" defaultValue="Email" className={inputClass}>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                  </select>
                </label>
                <button className={`${primaryButtonClass} w-fit`} type="submit">
                  <Bot size={15} /> Generate draft
                </button>
              </form>
            </section>
          ) : null}

          <Disclosure summary="Add internal note">
            {canAddNote && currentUser ? (
              <form action={addInternalNoteAction} className="flex flex-col gap-3">
                <input name="caseId" type="hidden" value={caseDetail.id} />
                <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="body">
                  Internal note
                  <textarea
                    id="body"
                    name="body"
                    minLength={3}
                    placeholder="Add context for the team..."
                    rows={4}
                    required
                    className={inputClass}
                  />
                </label>
                <button className={`${primaryButtonClass} w-fit`} type="submit">
                  Add note
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted">This user can view the case but cannot add notes.</p>
            )}
          </Disclosure>
        </div>

        <aside className="flex flex-col gap-6">
          <section className={cardClass}>
            <div className={cardHeaderClass}>
              <ClipboardList size={18} className="text-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Workflow actions</h2>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <form action={transitionCaseAction} className="flex flex-col gap-2">
                <input name="caseId" type="hidden" value={caseDetail.id} />
                <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                {permittedTransitions.length > 0 ? (
                  <>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="status">
                      Change status
                      <select id="status" name="status" className={inputClass}>
                        {permittedTransitions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className={primaryButtonClass} type="submit">
                      Update status
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    No further transitions available from &ldquo;{caseDetail.status}&rdquo;.
                  </p>
                )}
              </form>

              {canAssign && currentUser ? (
                <form action={assignCaseAction} className="flex flex-col gap-2 border-t border-line pt-4">
                  <input name="caseId" type="hidden" value={caseDetail.id} />
                  <input name="departmentId" type="hidden" value={caseDetail.departmentId} />
                  <input name="sourceSystem" type="hidden" value={sourceSystemParam ?? caseDetail.sourceSystem} />
                  {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
                  <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="assigneeId">
                    Assignee
                    <select
                      id="assigneeId"
                      name="assigneeId"
                      defaultValue={caseDetail.assigneeId ?? "unassigned"}
                      className={inputClass}
                    >
                      <option value="unassigned">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={primaryButtonClass} type="submit">
                    Save assignment
                  </button>
                </form>
              ) : (
                <p className="border-t border-line pt-4 text-sm text-muted">
                  This user cannot assign or reassign this case.
                </p>
              )}
            </div>
          </section>

          <Disclosure summary="Customer details">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Avatar name={caseDetail.customer.name ?? "Unknown customer"} size={28} />
                <span className="text-sm font-medium text-ink">{caseDetail.customer.name ?? "Unknown"}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Email</span>
                  <span className="text-ink">{caseDetail.customer.email ?? "Not provided"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Phone</span>
                  <span className="text-ink">{caseDetail.customer.phone ?? "Not provided"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">External ID</span>
                  <span className="text-ink">{caseDetail.customer.externalId ?? "Not provided"}</span>
                </div>
              </div>
            </div>
          </Disclosure>

          <Disclosure
            defaultOpen={conversationMessages.length > 0}
            summary={
              <span className="flex items-center gap-2">
                <MessageSquare size={16} className="text-muted" aria-hidden="true" />
                Conversation
              </span>
            }
          >
            {conversationMessages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {conversationMessages.map((message) => {
                  const outbound = message.direction === "outbound";
                  return (
                    <div key={message.id} className={`flex ${outbound ? "items-end" : "items-start"} flex-col gap-1`}>
                      <div
                        className={`max-w-full rounded-md border px-3 py-2 ${
                          outbound
                            ? "border-brand/30 bg-brand/10 text-ink"
                            : "border-line bg-panel-subtle text-ink"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <StatusBadge label={outbound ? "Team" : "Customer"} tone={outbound ? "ok" : "info"} />
                          <StatusBadge label={message.channel} tone="neutral" />
                          {outbound ? (
                            <StatusBadge
                              label={message.deliveryStatus}
                              tone={message.deliveryStatus === "Failed" ? "critical" : "info"}
                            />
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{message.body}</p>
                      </div>
                      <span className="text-xs text-muted">{formatDate(message.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={MessageSquare} message="No customer conversation yet." />
            )}
          </Disclosure>

          <Disclosure
            summary={
              <span className="flex items-center gap-2">
                <History size={16} className="text-muted" aria-hidden="true" />
                Activity timeline
              </span>
            }
          >
            <div className="flex flex-col gap-3">
              {timeline.length > 0 ? (
                <>
                  {visibleTimeline.map((item) => (
                    <div key={item.id} className={`${nestedCardClass} min-w-0`}>
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <strong className="break-words text-sm text-ink [overflow-wrap:anywhere]">{item.title}</strong>
                          <StatusBadge label={item.actor} tone="neutral" />
                        </div>
                        <span className="text-xs text-muted">{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="mt-2 break-words text-sm text-muted [overflow-wrap:anywhere]">{item.detail || item.actor}</p>
                      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                        <StatusBadge label={item.kind} tone={item.tone} />
                      </div>
                    </div>
                  ))}
                  {olderTimeline.length > 0 ? (
                    <Disclosure summary={`Show ${olderTimeline.length} earlier event${olderTimeline.length === 1 ? "" : "s"}`}>
                      <div className="flex flex-col gap-3">
                        {olderTimeline.map((item) => (
                          <div key={item.id} className={`${nestedCardClass} min-w-0`}>
                            <div className="flex min-w-0 flex-col gap-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <strong className="break-words text-sm text-ink [overflow-wrap:anywhere]">{item.title}</strong>
                                <StatusBadge label={item.actor} tone="neutral" />
                              </div>
                              <span className="text-xs text-muted">{formatDate(item.createdAt)}</span>
                            </div>
                            <p className="mt-2 break-words text-sm text-muted [overflow-wrap:anywhere]">{item.detail || item.actor}</p>
                            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                              <StatusBadge label={item.kind} tone={item.tone} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Disclosure>
                  ) : null}
                </>
              ) : (
                <EmptyState icon={History} message="No activity yet." />
              )}
            </div>
          </Disclosure>
        </aside>
      </div>
    </AppShell>
  );
}
