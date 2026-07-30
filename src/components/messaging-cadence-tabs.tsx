"use client";

import { useMemo, useState } from "react";
import { priorities } from "@/domain/constants";
import type { CaseStatus, Priority } from "@/domain/types";
import { StatusBadge, priorityTone } from "@/components/status-badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { Clock } from "lucide-react";

type CadencePolicy = {
  id: string;
  status: CaseStatus;
  priority: Priority;
  staleAfterHours: number;
  enabled: boolean;
};

type MessagingCadenceTabsProps = {
  action: (formData: FormData) => void | Promise<void>;
  initialPriority: Priority;
  policies: CadencePolicy[];
};

export function MessagingCadenceTabs({ action, initialPriority, policies }: MessagingCadenceTabsProps) {
  const [activePriority, setActivePriority] = useState<Priority>(initialPriority);

  const tabItems = useMemo(
    () =>
      priorities.map((priority) => ({
        key: priority,
        label: <StatusBadge label={priority} tone={priorityTone(priority)} />
      })),
    []
  );

  return (
    <Tabs items={tabItems} active={activePriority} onChange={(key) => setActivePriority(key as Priority)}>
      {(activeKey) => {
        const visiblePolicies = policies.filter((policy) => policy.priority === activeKey);
        return (
          <DataTable
            columns={[
              { key: "status", header: "Status", render: (policy) => policy.status },
              {
                key: "cadence",
                header: "Prompt timing",
                render: (policy) => (
                  <form action={action} className="flex flex-wrap items-center gap-2">
                    <input name="status" type="hidden" value={policy.status} />
                    <input name="priority" type="hidden" value={policy.priority} />
                    <input name="selectedPriority" type="hidden" value={activeKey} />
                    <input
                      aria-label={`${policy.status} ${policy.priority} customer update prompt hours`}
                      defaultValue={policy.staleAfterHours}
                      min={1}
                      name="staleAfterHours"
                      type="number"
                      className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                    <span className="text-sm text-muted">hours after last update</span>
                    <label className="flex items-center gap-1.5 text-sm text-muted">
                      <input
                        defaultChecked={policy.enabled}
                        name="enabled"
                        type="checkbox"
                        className="size-4 rounded border-line accent-brand"
                      />
                      Prompt enabled
                    </label>
                    <ConfirmSubmitButton
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                      confirmMessage={`Save prompt timing for ${policy.status} ${policy.priority} cases?`}
                      pendingChildren="Saving..."
                    >
                      Save
                    </ConfirmSubmitButton>
                  </form>
                )
              }
            ]}
            rows={visiblePolicies}
            getRowKey={(policy) => `${policy.status}-${policy.priority}`}
            emptyIcon={Clock}
            emptyMessage="No prompt rules for this priority yet."
          />
        );
      }}
    </Tabs>
  );
}
