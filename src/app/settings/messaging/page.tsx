import { AlertTriangle, MessageSquare, ShieldCheck } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { MessagingCadenceTabs } from "@/components/messaging-cadence-tabs";
import { StatusBadge } from "@/components/status-badge";
import { caseStatuses, priorities } from "@/domain/constants";
import type { CaseStatus, Priority } from "@/domain/types";
import { canManageAdmin } from "@/lib/access-control";
import { resolveCurrentUser } from "@/lib/current-user";
import { getMessagingProviderStatuses } from "@/lib/messaging";
import { createAdminService } from "@/services/admin";

export const dynamic = "force-dynamic";

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function selectedPriority(searchParams: Record<string, string | string[] | undefined>): Priority {
  const value = searchParams.cadencePriority;
  const priority = Array.isArray(value) ? value[0] : value;
  return priorities.includes(priority as Priority) ? (priority as Priority) : "Low";
}

async function updateMessagingCadenceAction(formData: FormData) {
  "use server";

  const currentUser = await resolveCurrentUser();
  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const selectedPriorityValue = String(formData.get("selectedPriority") ?? priority);
  const staleAfterHours = Number(formData.get("staleAfterHours") ?? 0);

  if (!currentUser || !canManageAdmin(currentUser)) {
    throw new Error("Current user cannot manage settings");
  }

  if (!caseStatuses.includes(status as CaseStatus) || !priorities.includes(priority as Priority) || staleAfterHours < 1) {
    throw new Error("Invalid messaging cadence setting");
  }

  await createAdminService().updateMessagingCadence(
    {
      status: status as CaseStatus,
      priority: priority as Priority,
      staleAfterHours,
      enabled: checkboxValue(formData, "enabled")
    },
    currentUser.id
  );
  revalidatePath("/settings/messaging");
  redirect(`/settings/messaging?cadencePriority=${encodeURIComponent(selectedPriorityValue)}`);
}

export default async function SettingsMessagingPage({
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
        <EmptyState icon={ShieldCheck} message="Admin settings are only available to platform admins." />
      </section>
    );
  }

  const resolvedSearchParams = await searchParams;
  const activeCadencePriority = selectedPriority(resolvedSearchParams);
  const directory = await createAdminService().getMessagingDirectory();
  const providerStatuses = getMessagingProviderStatuses();
  const liveProviderStatuses = providerStatuses.filter((status) => status.live);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <MessageSquare size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Provider configuration</h2>
        </div>
        {liveProviderStatuses.length > 0 ? (
          <div className="mx-5 mt-5 flex items-start gap-3 rounded-md border border-warning bg-warning-bg px-4 py-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm">
              <strong className="block text-ink">Live customer delivery is enabled</strong>
              <span className="text-muted">
                {liveProviderStatuses.map((status) => `${status.channel}: ${status.label}`).join(", ")} will send real customer messages.
              </span>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          {providerStatuses.map((status) => (
            <div className="rounded-md border border-line p-4" key={status.channel}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{status.channel}</div>
                  <div className="mt-1 text-xs text-muted">{status.label}</div>
                </div>
                <StatusBadge
                  label={status.live ? "Live" : status.mode === "stub" ? "Stub" : status.configured ? "Configured" : "Missing"}
                  tone={status.live ? "critical" : status.mode === "stub" ? "warning" : status.configured ? "ok" : "critical"}
                />
              </div>
              <p className="mt-3 break-words text-sm text-muted">{status.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <MessageSquare size={18} className="text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Customer update prompts</h2>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <p className="rounded-md border border-info/20 bg-info-bg px-3 py-2 text-sm text-info">
            These rules control when cases appear as needing a customer follow-up. They do not send messages automatically.
          </p>
          <MessagingCadenceTabs
            action={updateMessagingCadenceAction}
            initialPriority={activeCadencePriority}
            policies={directory.messagingCadence}
          />
        </div>
      </section>
    </div>
  );
}
