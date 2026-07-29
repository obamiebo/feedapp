import { ClipboardList, Filter, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { canManageAdmin } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { createAdminService } from "@/services/admin";
import type { AuditLogListRecord } from "@/repositories/audit-logs";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function metadataPreview(metadata: AuditLogListRecord["metadata"]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata ? String(metadata) : "None";
  }

  return Object.entries(metadata)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : "..."}`)
    .join(", ");
}

function metadataJson(metadata: AuditLogListRecord["metadata"]) {
  return JSON.stringify(metadata ?? null, null, 2);
}

const auditActionOptions = [
  { value: "admin.department_created", label: "Department created" },
  { value: "admin.messaging_cadence_updated", label: "Messaging cadence updated" },
  { value: "admin.product_group_created", label: "Product group created" },
  { value: "admin.product_source_callback_updated", label: "Product callback updated" },
  { value: "admin.product_source_created", label: "Product source created" },
  { value: "admin.product_source_secret_rotated", label: "Product secret rotated" },
  { value: "admin.product_source_updated", label: "Product source updated" },
  { value: "admin.sla_policy_updated", label: "SLA policy updated" },
  { value: "admin.user_access_updated", label: "User access updated" },
  { value: "admin.user_created", label: "User created" },
  { value: "product_roster.user_added", label: "Product roster user added" },
  { value: "product_roster.user_removed", label: "Product roster user removed" }
];

export default async function SettingsAuditPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!canManageAdmin(currentUser)) {
    return (
      <section className="rounded-lg border border-line bg-panel p-6 shadow-sm">
        <EmptyState icon={ShieldCheck} message="Audit logs are only available to platform admins." />
      </section>
    );
  }

  const resolvedSearchParams = await searchParams;
  const action = firstParam(resolvedSearchParams.action)?.trim() ?? "";
  const actorSearch = firstParam(resolvedSearchParams.actor)?.trim() ?? "";
  const selectedAction = auditActionOptions.some((option) => option.value === action) ? action : "";
  const directory = await createAdminService().getAuditDirectory({
    action: selectedAction || undefined,
    actorSearch: actorSearch || undefined,
    limit: 100
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Filter size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Audit filters</h2>
        </div>
        <form className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" method="get">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Action
            <select
              name="action"
              defaultValue={selectedAction}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">All admin-visible actions</option>
              {auditActionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Actor
            <input
              name="actor"
              defaultValue={actorSearch}
              placeholder="Name or email"
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <button
            className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            type="submit"
          >
            Apply
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex flex-col gap-1 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Audit log</h2>
          </div>
          <span className="text-xs text-muted">Showing latest {directory.auditLogs.length} admin-visible events</span>
        </div>
        <div className="p-2">
          <DataTable<AuditLogListRecord>
            columns={[
              {
                key: "createdAt",
                header: "Time",
                render: (record) => <span className="whitespace-nowrap text-sm text-muted">{formatDate(record.createdAt)}</span>
              },
              {
                key: "actor",
                header: "Actor",
                render: (record) =>
                  record.actorName ? (
                    <div>
                      <div className="font-medium text-ink">{record.actorName}</div>
                      <div className="text-xs text-muted">{record.actorEmail}</div>
                    </div>
                  ) : (
                    <span className="text-muted">System</span>
                  )
              },
              {
                key: "action",
                header: "Action",
                render: (record) => <span className="font-medium text-ink">{record.action}</span>
              },
              {
                key: "case",
                header: "Case",
                render: (record) =>
                  record.caseTitle ? (
                    <div>
                      <div className="font-medium text-ink">{record.caseTitle}</div>
                      <div className="text-xs text-muted">{record.caseSourceSystem}</div>
                    </div>
                  ) : (
                    <span className="text-muted">None</span>
                  )
              },
              {
                key: "metadata",
                header: "Metadata",
                render: (record) => (
                  <details className="max-w-md">
                    <summary className="cursor-pointer text-sm text-muted">{metadataPreview(record.metadata)}</summary>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-panel-muted p-3 text-xs text-ink">
                      {metadataJson(record.metadata)}
                    </pre>
                  </details>
                )
              }
            ]}
            rows={directory.auditLogs}
            getRowKey={(record) => record.id}
            emptyIcon={ClipboardList}
            emptyMessage="No admin-visible audit events match these filters."
          />
        </div>
      </section>
    </div>
  );
}
