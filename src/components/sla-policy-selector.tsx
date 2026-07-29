"use client";

import { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/ui/data-table";
import type { Priority } from "@/domain/types";

export type SlaPolicyRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  priority: Priority;
  responseTargetHours: number;
  resolutionTargetHours: number;
  escalationTargetHours: number;
  configured: boolean;
};

type SlaPolicySelectorProps = {
  action: (formData: FormData) => void | Promise<void>;
  rows: SlaPolicyRow[];
};

export function SlaPolicySelector({ action, rows }: SlaPolicySelectorProps) {
  const departments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      seen.set(row.departmentId, row.departmentName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(departments[0]?.id ?? "");
  const visibleRows = rows.filter((row) => row.departmentId === selectedDepartmentId);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm text-muted" htmlFor="sla-department">
        Department
        <select
          id="sla-department"
          value={selectedDepartmentId}
          onChange={(event) => setSelectedDepartmentId(event.target.value)}
          className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <DataTable<SlaPolicyRow>
        columns={[
          {
            key: "priority",
            header: "Priority",
            render: (policy) => <StatusBadge label={policy.priority} tone="info" />
          },
          {
            key: "status",
            header: "Policy",
            render: (policy) => (
              <span className="text-sm text-muted">{policy.configured ? "Configured" : "Default targets"}</span>
            )
          },
          {
            key: "targets",
            header: "Targets",
            render: (policy) => (
              <form action={action} className="flex flex-wrap items-end gap-2">
                <input name="departmentId" type="hidden" value={policy.departmentId} />
                <input name="priority" type="hidden" value={policy.priority} />
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Response
                  <input
                    aria-label={`${policy.departmentName} ${policy.priority} response target hours`}
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
                    defaultValue={policy.responseTargetHours}
                    min={1}
                    name="responseTargetHours"
                    required
                    type="number"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Resolution
                  <input
                    aria-label={`${policy.departmentName} ${policy.priority} resolution target hours`}
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
                    defaultValue={policy.resolutionTargetHours}
                    min={1}
                    name="resolutionTargetHours"
                    required
                    type="number"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Escalation
                  <input
                    aria-label={`${policy.departmentName} ${policy.priority} escalation target hours`}
                    className="w-20 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
                    defaultValue={policy.escalationTargetHours}
                    min={1}
                    name="escalationTargetHours"
                    required
                    type="number"
                  />
                </label>
                <button
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                  type="submit"
                >
                  Save
                </button>
              </form>
            )
          }
        ]}
        rows={visibleRows}
        getRowKey={(policy) => policy.id}
        emptyIcon={Gauge}
        emptyMessage="No SLA policies are available for this department."
      />
    </div>
  );
}
