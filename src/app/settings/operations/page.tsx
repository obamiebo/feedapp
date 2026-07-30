import { Activity, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { SlaPolicySelector, type SlaPolicyRow } from "@/components/sla-policy-selector";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DataTable } from "@/components/ui/data-table";
import { priorities } from "@/domain/constants";
import type { Priority } from "@/domain/types";
import { canManageAdmin } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { createPrismaIntegrationRepository, type IntegrationCallbackAttemptRecord } from "@/repositories/integrations";
import { createPrismaMessageRepository, type OutboundMessageOperation } from "@/repositories/messages";
import { createAdminService } from "@/services/admin";
import { createCaseService } from "@/services/cases";

export const dynamic = "force-dynamic";

function formatDate(value?: Date | null) {
  if (!value) return "Not attempted";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function readableChannel(channel: string) {
  switch (channel) {
    case "EMAIL":
      return "Email";
    case "SMS":
      return "SMS";
    default:
      return channel;
  }
}

function recipient(message: OutboundMessageOperation) {
  return message.channel === "SMS" ? message.case.customer.phone : message.case.customer.email;
}

function deliveryTone(status: string) {
  switch (status) {
    case "SENT":
      return "ok";
    case "FAILED":
      return "critical";
    case "ACCEPTED":
      return "warning";
    default:
      return "neutral";
  }
}

function deliveryLabel(status: string) {
  if (status === "ACCEPTED") {
    return "Accepted by provider";
  }

  return status;
}

function numberValue(formData: FormData, key: string) {
  return Number(formData.get(key) ?? 0);
}

async function updateSlaPolicyAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const departmentId = String(formData.get("departmentId") ?? "");
  const priority = String(formData.get("priority") ?? "");

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage operations");
  }

  if (!priorities.includes(priority as Priority)) {
    throw new Error("Valid SLA priority is required");
  }

  await createAdminService().updateSlaPolicy(
    {
      departmentId,
      priority: priority as Priority,
      responseTargetHours: numberValue(formData, "responseTargetHours"),
      resolutionTargetHours: numberValue(formData, "resolutionTargetHours"),
      escalationTargetHours: numberValue(formData, "escalationTargetHours")
    },
    currentUser.id
  );
  revalidatePath("/settings/operations");
  redirect("/settings/operations");
}

async function retryFailedMessagesAction() {
  "use server";

  const currentUser = await resolveCurrentUser();

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage operations");
  }

  const result = await createCaseService().retryFailedCustomerMessages();
  revalidatePath("/settings/operations");
  redirect(`/settings/operations?messageAttempted=${result.attempted}&messageRetried=${result.retried}&messageFailed=${result.failed}`);
}

async function retryFailedCallbacksAction() {
  "use server";

  const currentUser = await resolveCurrentUser();

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage operations");
  }

  const result = await createCaseService().retryFailedProductCallbacks();
  revalidatePath("/settings/operations");
  redirect(`/settings/operations?callbackAttempted=${result.attempted}&callbackRetried=${result.retried}&callbackFailed=${result.failed}`);
}

export default async function SettingsOperationsPage({
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
        <EmptyState icon={ShieldCheck} message="Operations are only available to platform admins." />
      </section>
    );
  }

  const resolvedSearchParams = await searchParams;
  const messageAttempted = Array.isArray(resolvedSearchParams.messageAttempted)
    ? resolvedSearchParams.messageAttempted[0]
    : resolvedSearchParams.messageAttempted;
  const messageRetried = Array.isArray(resolvedSearchParams.messageRetried)
    ? resolvedSearchParams.messageRetried[0]
    : resolvedSearchParams.messageRetried;
  const messageFailed = Array.isArray(resolvedSearchParams.messageFailed)
    ? resolvedSearchParams.messageFailed[0]
    : resolvedSearchParams.messageFailed;
  const callbackAttempted = Array.isArray(resolvedSearchParams.callbackAttempted)
    ? resolvedSearchParams.callbackAttempted[0]
    : resolvedSearchParams.callbackAttempted;
  const callbackRetried = Array.isArray(resolvedSearchParams.callbackRetried)
    ? resolvedSearchParams.callbackRetried[0]
    : resolvedSearchParams.callbackRetried;
  const callbackFailed = Array.isArray(resolvedSearchParams.callbackFailed)
    ? resolvedSearchParams.callbackFailed[0]
    : resolvedSearchParams.callbackFailed;
  const messageRepository = createPrismaMessageRepository();
  const [recentMessages, failedMessages, failedCallbacks, slaDirectory] = await Promise.all([
    messageRepository.listRecentOutboundMessages(25),
    messageRepository.listFailedOutboundMessages(100),
    createPrismaIntegrationRepository().listFailedCallbackAttempts(100),
    createAdminService().getSlaDirectory()
  ]);
  const slaPolicyMap = new Map(
    slaDirectory.slaPolicies.map((policy) => [`${policy.departmentId}:${policy.priority}`, policy])
  );
  const defaultSlaTargets: Record<Priority, { response: number; resolution: number; escalation: number }> = {
    Low: { response: 8, resolution: 72, escalation: 24 },
    Medium: { response: 4, resolution: 48, escalation: 12 },
    High: { response: 2, resolution: 24, escalation: 8 },
    Critical: { response: 1, resolution: 8, escalation: 2 }
  };
  const slaRows: SlaPolicyRow[] = slaDirectory.departments.flatMap((department) =>
    priorities.map((priority) => {
      const policy = slaPolicyMap.get(`${department.id}:${priority}`);
      const fallback = defaultSlaTargets[priority];
      return {
        id: `${department.id}:${priority}`,
        departmentId: department.id,
        departmentName: department.name,
        priority,
        responseTargetHours: policy?.responseTargetHours ?? fallback.response,
        resolutionTargetHours: policy?.resolutionTargetHours ?? fallback.resolution,
        escalationTargetHours: policy?.escalationTargetHours ?? fallback.escalation,
        configured: Boolean(policy)
      };
    })
  );
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">SLA policies</h2>
            <StatusBadge label={`${slaDirectory.slaPolicies.length} configured`} tone="info" />
          </div>
        </div>
        <div className="p-2">
          {slaRows.length > 0 ? (
            <SlaPolicySelector action={updateSlaPolicyAction} rows={slaRows} />
          ) : (
            <EmptyState icon={Gauge} message="No departments are available for SLA policy management." />
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Recent customer deliveries</h2>
          <StatusBadge label={`${recentMessages.length} recent`} tone="info" />
        </div>
      </div>
      <div className="mx-5 mt-4 rounded-md border border-info/20 bg-info-bg px-3 py-2 text-sm text-info">
        Accepted means the provider received the message request. Customer delivery is only confirmed if a provider delivery callback is added later.
      </div>
      <div className="p-2">
        <DataTable<OutboundMessageOperation>
          columns={[
            {
              key: "case",
              header: "Case",
              render: (message) => (
                <div>
                  <Link className="font-medium text-brand hover:text-brand-dark" href={`/cases/${message.caseId}` as Route}>
                    {message.case.title}
                  </Link>
                  <div className="text-xs text-muted">{message.case.sourceSystem}</div>
                </div>
              )
            },
            {
              key: "recipient",
              header: "Recipient",
              render: (message) => (
                <div>
                  <div>{message.case.customer.name ?? "Unknown customer"}</div>
                  <div className="text-xs text-muted">{recipient(message) ?? "Missing recipient"}</div>
                </div>
              )
            },
            {
              key: "channel",
              header: "Channel",
              render: (message) => <StatusBadge label={readableChannel(message.channel)} tone="info" />
            },
            {
              key: "status",
              header: "Status",
              render: (message) => <StatusBadge label={deliveryLabel(message.deliveryStatus)} tone={deliveryTone(message.deliveryStatus)} />
            },
            {
              key: "attempts",
              header: "Attempts",
              render: (message) => message.deliveryAttempts
            },
            {
              key: "lastAttempt",
              header: "Last attempt",
              render: (message) => formatDate(message.lastDeliveryAttemptAt)
            },
            {
              key: "error",
              header: "Error",
              render: (message) => <span className="text-critical">{message.deliveryError ?? "None"}</span>
            }
          ]}
          rows={recentMessages}
          getRowKey={(message) => message.id}
          emptyIcon={Activity}
          emptyMessage="No customer deliveries recorded yet."
        />
      </div>
    </section>
    <section className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Failed customer deliveries</h2>
          <StatusBadge label={`${failedMessages.length} failed`} tone={failedMessages.length > 0 ? "critical" : "ok"} />
        </div>
        <form action={retryFailedMessagesAction}>
          <ConfirmSubmitButton
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            confirmMessage="Retry all failed customer deliveries?"
            disabled={failedMessages.length === 0}
            pendingChildren="Retrying..."
          >
            <RefreshCw size={15} /> Retry failed
          </ConfirmSubmitButton>
        </form>
      </div>

      {messageAttempted ? (
        <div className="mx-5 mt-4 rounded-md border border-info/20 bg-info-bg px-3 py-2 text-sm text-info">
          Retry attempted {messageAttempted} message{messageAttempted === "1" ? "" : "s"}; {messageRetried ?? "0"} accepted again, {messageFailed ?? "0"} still failed.
        </div>
      ) : null}

      <div className="p-2">
        <DataTable<OutboundMessageOperation>
          columns={[
            {
              key: "case",
              header: "Case",
              render: (message) => (
                <div>
                  <Link className="font-medium text-brand hover:text-brand-dark" href={`/cases/${message.caseId}` as Route}>
                    {message.case.title}
                  </Link>
                  <div className="text-xs text-muted">{message.case.sourceSystem}</div>
                </div>
              )
            },
            {
              key: "recipient",
              header: "Recipient",
              render: (message) => (
                <div>
                  <div>{message.case.customer.name ?? "Unknown customer"}</div>
                  <div className="text-xs text-muted">{recipient(message) ?? "Missing recipient"}</div>
                </div>
              )
            },
            {
              key: "channel",
              header: "Channel",
              render: (message) => <StatusBadge label={readableChannel(message.channel)} tone="info" />
            },
            {
              key: "attempts",
              header: "Attempts",
              render: (message) => message.deliveryAttempts
            },
            {
              key: "lastAttempt",
              header: "Last attempt",
              render: (message) => formatDate(message.lastDeliveryAttemptAt)
            },
            {
              key: "error",
              header: "Error",
              render: (message) => <span className="text-critical">{message.deliveryError ?? "Delivery failed"}</span>
            }
          ]}
          rows={failedMessages}
          getRowKey={(message) => message.id}
          emptyIcon={Activity}
          emptyMessage="No failed customer deliveries."
        />
      </div>
    </section>
    <section className="rounded-lg border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Failed product callbacks</h2>
          <StatusBadge label={`${failedCallbacks.length} failed`} tone={failedCallbacks.length > 0 ? "critical" : "ok"} />
        </div>
        <form action={retryFailedCallbacksAction}>
          <ConfirmSubmitButton
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            confirmMessage="Retry all failed product callbacks?"
            disabled={failedCallbacks.length === 0}
            pendingChildren="Retrying..."
          >
            <RefreshCw size={15} /> Retry callbacks
          </ConfirmSubmitButton>
        </form>
      </div>

      {callbackAttempted ? (
        <div className="mx-5 mt-4 rounded-md border border-info/20 bg-info-bg px-3 py-2 text-sm text-info">
          Retry attempted {callbackAttempted} callback{callbackAttempted === "1" ? "" : "s"}; {callbackRetried ?? "0"} sent, {callbackFailed ?? "0"} still failed.
        </div>
      ) : null}

      <div className="p-2">
        <DataTable<IntegrationCallbackAttemptRecord>
          columns={[
            {
              key: "case",
              header: "Case",
              render: (attempt) => (
                <div>
                  <Link className="font-medium text-brand hover:text-brand-dark" href={`/cases/${attempt.caseId}` as Route}>
                    {attempt.caseTitle}
                  </Link>
                  <div className="text-xs text-muted">{attempt.sourceName}</div>
                </div>
              )
            },
            { key: "event", header: "Event", render: (attempt) => attempt.eventType },
            { key: "attempts", header: "Attempts", render: (attempt) => attempt.deliveryAttempts },
            { key: "lastAttempt", header: "Last attempt", render: (attempt) => formatDate(attempt.lastAttemptAt) },
            {
              key: "error",
              header: "Error",
              render: (attempt) => <span className="text-critical">{attempt.lastError ?? "Callback delivery failed"}</span>
            }
          ]}
          rows={failedCallbacks}
          getRowKey={(attempt) => attempt.id}
          emptyIcon={Activity}
          emptyMessage="No failed product callbacks."
        />
      </div>
    </section>
    </div>
  );
}
