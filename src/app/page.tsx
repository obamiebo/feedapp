import { AlertTriangle, Bell, CheckCircle2, ChevronLeft, ChevronRight, Inbox, MessageSquare } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, priorityTone, slaLabel, slaTone, statusTone } from "@/components/status-badge";
import { caseStatuses, priorities } from "@/domain/constants";
import type { CaseStatus, Priority } from "@/domain/types";
import { canCreateCase, canEnterApplication } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { greeting } from "@/lib/greeting";
import { isSlaAtRisk, isSlaBreached } from "@/lib/sla";
import type { CaseListFilters, CaseListItem, CaseSlaState } from "@/repositories/cases";
import { createPrismaIntegrationRepository } from "@/repositories/integrations";
import { createPrismaUserRepository } from "@/repositories/users";
import { createCaseTagService } from "@/services/case-tags";
import { createCaseService } from "@/services/cases";

export const dynamic = "force-dynamic";

type DashboardSearchParams = Record<string, string | string[] | undefined>;

function firstParam(searchParams: DashboardSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(searchParams: DashboardSearchParams): CaseListFilters {
  const status = firstParam(searchParams, "status");
  const priority = firstParam(searchParams, "priority");
  const departmentId = firstParam(searchParams, "departmentId");
  const productGroupId = firstParam(searchParams, "productGroupId");
  const assigneeId = firstParam(searchParams, "assigneeId");
  const sourceSystem = firstParam(searchParams, "sourceSystem");
  const tagId = firstParam(searchParams, "tagId");
  const slaState = firstParam(searchParams, "slaState");
  const search = firstParam(searchParams, "search");

  return {
    status: caseStatuses.includes(status as CaseStatus) ? (status as CaseStatus) : undefined,
    priority: priorities.includes(priority as Priority) ? (priority as Priority) : undefined,
    departmentId: departmentId || undefined,
    productGroupId: productGroupId || undefined,
    assigneeId: assigneeId || undefined,
    sourceSystem: sourceSystem || undefined,
    tagId: tagId || undefined,
    slaState: ["on-track", "at-risk", "breached"].includes(slaState ?? "")
      ? (slaState as CaseSlaState)
      : undefined,
    search: search || undefined
  };
}

function parsePage(searchParams: DashboardSearchParams) {
  const page = Number(firstParam(searchParams, "page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function paginationHref(filters: CaseListFilters, page: number, embedMode = false): Route {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, String(value));
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (embedMode) {
    params.set("entryMode", "embed");
  }

  return `/?${params.toString()}` as Route;
}

function caseDetailHref(caseId: string, filters: CaseListFilters, embedMode: boolean): Route {
  const params = new URLSearchParams();

  if (filters.sourceSystem) {
    params.set("sourceSystem", filters.sourceSystem);
  }

  if (embedMode) {
    params.set("entryMode", "embed");
  }

  const query = params.toString();
  return `/cases/${caseId}${query ? `?${query}` : ""}` as Route;
}

function activeFilterCount(filters: CaseListFilters) {
  return Object.values(filters).filter(Boolean).length;
}

function readableChannel(channel: string) {
  return channel
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function priorityRank(priority: string) {
  const readablePriority = readableChannel(priority);

  switch (readablePriority) {
    case "Critical":
      return 0;
    case "High":
      return 1;
    case "Medium":
      return 2;
    case "Low":
      return 3;
    default:
      return 4;
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const filters = parseFilters(resolvedSearchParams);
  const embedMode = firstParam(resolvedSearchParams, "entryMode") === "embed";
  const page = parsePage(resolvedSearchParams);
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.passwordMustChange) {
    redirect("/change-password");
  }

  if (!canEnterApplication(currentUser)) {
    return (
      <AppShell active="cases" currentUser={currentUser} entryMode={embedMode ? "embed" : undefined} sourceSystem={filters.sourceSystem}>
        <main className="flex flex-col gap-6">
          <PageHeader eyebrow={greeting(new Date())} title="Case operations" />
          <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
            <EmptyState icon={Inbox} message="This user is not provisioned for application access." />
          </section>
        </main>
      </AppShell>
    );
  }

  const caseService = createCaseService();
  const integrationRepository = createPrismaIntegrationRepository();
  const [productSources, productGroups, users] = await Promise.all([
    integrationRepository.listProductSources(),
    integrationRepository.listProductGroups(),
    createPrismaUserRepository().listAssignableUsers()
  ]);
  const selectedGroupSourceKeys = filters.productGroupId
    ? productSources.filter((source) => source.groupId === filters.productGroupId).map((source) => source.key)
    : undefined;
  const queryFilters: CaseListFilters = {
    ...filters,
    sourceSystems: selectedGroupSourceKeys && selectedGroupSourceKeys.length > 0 ? selectedGroupSourceKeys : undefined
  };
  const tagSourceKey = filters.sourceSystem || currentUser.productSourceKeys[0];
  const [casePage, stalePrompts, pendingApprovals, stats, caseTags] = await Promise.all([
    caseService.listCasesPageForUser(currentUser, { ...queryFilters, page, pageSize: 10 }),
    caseService.listStaleCustomerUpdatePromptsForUser(currentUser),
    caseService.listPendingCustomerReplyApprovalsForUser(currentUser, 8),
    caseService.getCaseStatsForUser(currentUser, queryFilters),
    tagSourceKey ? createCaseTagService().listTagsForSourceForUser(tagSourceKey, currentUser).catch(() => []) : Promise.resolve([])
  ]);
  const cases = casePage?.items ?? [];
  const sortedPendingApprovals = [...pendingApprovals].sort((a, b) => {
    const priorityDelta = priorityRank(a.case.priority) - priorityRank(b.case.priority);
    return priorityDelta || a.createdAt.getTime() - b.createdAt.getTime();
  });
  const sortedStalePrompts = [...stalePrompts].sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    return priorityDelta || a.startedAt.getTime() - b.startedAt.getTime();
  });
  const hasOperationsQueueItems = sortedPendingApprovals.length > 0 || sortedStalePrompts.length > 0;
  const filterCount = activeFilterCount(filters);
  const firstName = currentUser.name.split(" ")[0];
  const openCasesCount = caseStatuses
    .filter((status) => status !== "Closed")
    .reduce((sum, status) => sum + stats.byStatus[status], 0);
  const filterSection = (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" aria-label="Case filters">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Filters</h2>
        <span className="text-xs text-muted">{filterCount} active</span>
      </div>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/" method="get">
        {embedMode ? <input name="entryMode" type="hidden" value="embed" /> : null}
        <label className="flex flex-col gap-1 text-sm text-muted">
          Search
          <input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Case, customer, source..."
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All statuses</option>
            {caseStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Priority
          <select
            name="priority"
            defaultValue={filters.priority ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Product group
          <select
            name="productGroupId"
            defaultValue={filters.productGroupId ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All groups</option>
            {productGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Assignee
          <select
            name="assigneeId"
            defaultValue={filters.assigneeId ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Product
          <select
            name="sourceSystem"
            defaultValue={filters.sourceSystem ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All products ({productSources.length})</option>
            {productSources.map((source) => (
              <option key={source.id} value={source.key}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          SLA
          <select
            name="slaState"
            defaultValue={filters.slaState ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All SLA states</option>
            <option value="on-track">On track</option>
            <option value="at-risk">At risk</option>
            <option value="breached">Breached</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Tag
          <select
            name="tagId"
            defaultValue={filters.tagId ?? ""}
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All tags</option>
            {caseTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Link
            className="inline-flex items-center rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
            href={embedMode ? "/?entryMode=embed" : "/"}
          >
            Reset
          </Link>
          <button
            className="inline-flex items-center rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            type="submit"
          >
            Apply filters
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <AppShell active="cases" currentUser={currentUser} entryMode={embedMode ? "embed" : undefined} sourceSystem={filters.sourceSystem}>
      <PageHeader
        eyebrow="Internal case operations"
        title={`${greeting()}, ${firstName}`}
        subtitle="Here's what's happening across your scoped cases today."
        actions={
          <>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
              type="button"
            >
              <Bell size={16} /> SLA alerts
            </button>
            {canCreateCase(currentUser) ? (
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                href={embedMode ? "/cases/new?entryMode=embed" : "/cases/new"}
              >
                <MessageSquare size={16} /> New case
              </Link>
            ) : null}
          </>
        }
      />

      {!currentUser || !canEnterApplication(currentUser) ? (
        <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
          <EmptyState icon={Inbox} message="This user is not provisioned for application access." />
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Case statistics">
            <StatCard
              icon={Inbox}
              label="Open cases"
              value={openCasesCount}
              trend={{
                deltaPct: stats.newCaseTrend.deltaPct,
                comparisonLabel: "new volume vs last week",
                positive: (stats.newCaseTrend.deltaPct ?? 0) >= 0
              }}
            />
            <StatCard icon={AlertTriangle} label="SLA at risk" value={stats.atRisk} tone="warning" />
            <StatCard icon={AlertTriangle} label="SLA breached" value={stats.breached} tone="critical" />
            <StatCard
              icon={CheckCircle2}
              label="Resolved this week"
              value={stats.resolvedTrend.currentWeek}
              tone="ok"
              trend={{
                deltaPct: stats.resolvedTrend.deltaPct,
                comparisonLabel: "vs previous week",
                positive: (stats.resolvedTrend.deltaPct ?? 0) >= 0
              }}
            />
          </section>

          {filterSection}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-line bg-panel shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">Active cases</h2>
                <span className="text-xs text-muted">
                  {casePage ? `${casePage.total} scoped cases` : "SSO gated + scoped access"}
                </span>
              </div>
              <div className="p-2">
                <DataTable<CaseListItem>
                  columns={[
                    {
                      key: "case",
                      header: "Case",
                      render: (item) => (
                        <div className="flex items-center gap-3">
                          <Avatar name={item.customerName ?? item.sourceSystem} size={32} />
                          <div>
                            <div className="font-medium text-ink">{item.title}</div>
                            <div className="text-xs text-muted">
                              {item.id} · {item.customerName ?? "Unknown customer"}
                            </div>
                            {(item.tags ?? []).length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(item.tags ?? []).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (item) => <StatusBadge label={item.status} tone={statusTone(item.status)} />
                    },
                    {
                      key: "priority",
                      header: "Priority",
                      render: (item) => <StatusBadge label={item.priority} tone={priorityTone(item.priority)} />
                    },
                    {
                      key: "product",
                      header: "Product",
                      render: (item) => {
                        const product = productSources.find((source) => source.key === item.sourceSystem);
                        return <span className="text-sm text-muted">{product?.name ?? item.sourceSystem}</span>;
                      }
                    },
                    {
                      key: "sla",
                      header: "SLA",
                      render: (item) => {
                        const sla = { breached: isSlaBreached(item), atRisk: isSlaAtRisk(item) };
                        return <StatusBadge label={slaLabel(sla)} tone={slaTone(sla)} />;
                      }
                    }
                  ]}
                  rows={cases}
                  rowHref={(item) => caseDetailHref(item.id, filters, embedMode)}
                  getRowKey={(item) => item.id}
                  emptyIcon={Inbox}
                  emptyMessage="No cases yet."
                />
              </div>
              {casePage && casePage.pageCount > 1 ? (
                <div className="flex items-center justify-between border-t border-line px-5 py-4">
                  <div className="text-sm text-muted">
                    Page {casePage.page} of {casePage.pageCount}
                  </div>
                  <div className="flex items-center gap-2">
                    {casePage.page > 1 ? (
                      <Link
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
                        href={paginationHref(filters, casePage.page - 1, embedMode)}
                      >
                        <ChevronLeft size={14} /> Previous
                      </Link>
                    ) : (
                      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted/50">
                        <ChevronLeft size={14} /> Previous
                      </span>
                    )}
                    {casePage.page < casePage.pageCount ? (
                      <Link
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
                        href={paginationHref(filters, casePage.page + 1, embedMode)}
                      >
                        Next <ChevronRight size={14} />
                      </Link>
                    ) : (
                      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted/50">
                        Next <ChevronRight size={14} />
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="rounded-lg border border-line bg-panel p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Operations queue</h2>
                <AlertTriangle size={16} className="text-muted" aria-hidden="true" />
              </div>
              {hasOperationsQueueItems ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Pending approvals</h3>
                        <p className="mt-0.5 text-xs text-muted">Customer messages waiting for approval.</p>
                      </div>
                      <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
                        {sortedPendingApprovals.length}
                      </span>
                    </div>
                    {sortedPendingApprovals.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {sortedPendingApprovals.map((approval) => {
                          const priority = readableChannel(approval.case.priority);

                          return (
                            <Link
                              className="rounded-md border border-line p-3 text-sm transition-colors hover:bg-panel-muted"
                              href={caseDetailHref(approval.caseId, filters, embedMode)}
                              key={approval.id}
                            >
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <StatusBadge label={priority} tone={priorityTone(priority)} />
                                <StatusBadge label={readableChannel(approval.channel)} tone="info" />
                              </div>
                              <strong className="block break-words text-ink">{approval.case.title}</strong>
                              <span className="mt-1 block text-xs text-muted">
                                {approval.case.customer.name ?? approval.case.sourceSystem} · Requested {formatDate(approval.createdAt)}
                              </span>
                              <span className="mt-1 block text-xs text-muted">
                                Routed to {approval.requestedReviewer?.name ?? "eligible reviewers"}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">
                        No approvals waiting.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Customer follow-ups</h3>
                        <p className="mt-0.5 text-xs text-muted">Cases needing a customer update.</p>
                      </div>
                      <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-semibold text-info">
                        {sortedStalePrompts.length}
                      </span>
                    </div>
                    {sortedStalePrompts.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {sortedStalePrompts.slice(0, 3).map((prompt) => (
                          <Link
                            className="rounded-md border border-line p-3 text-sm transition-colors hover:bg-panel-muted"
                            href={caseDetailHref(prompt.caseId, filters, embedMode)}
                            key={prompt.id}
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <StatusBadge label={prompt.priority} tone={priorityTone(prompt.priority)} />
                              <StatusBadge label={prompt.status} tone={statusTone(prompt.status)} />
                            </div>
                            <strong className="block break-words text-ink">{prompt.case.title}</strong>
                            <span className="mt-1 block text-xs text-muted">
                              {prompt.case.assigneeName ?? prompt.case.sourceSystem}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">
                        No customer follow-ups waiting.
                      </p>
                    )}
                  </div>
                  {/* Future queue signals: failed customer messages, failed product callbacks, SLA risks, ingestion failures, connector health, and recommendation follow-ups. */}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} message="No operational items need attention." />
              )}
            </aside>
          </section>
        </div>
      )}
    </AppShell>
  );
}
