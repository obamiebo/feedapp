import { caseStatuses, priorities } from "@/domain/constants";
import type { CaseStatus, Priority } from "@/domain/types";

export type MessagingCadenceDefault = {
  status: CaseStatus;
  priority: Priority;
  staleAfterHours: number;
  enabled: boolean;
};

const activeStatusHours: Record<Priority, number> = {
  Critical: 24,
  High: 48,
  Medium: 72,
  Low: 96
};

const newStatusHours: Record<Priority, number> = {
  Critical: 4,
  High: 8,
  Medium: 24,
  Low: 48
};

export function defaultMessagingCadencePolicies(): MessagingCadenceDefault[] {
  return caseStatuses.flatMap((status) =>
    priorities.map((priority) => {
      const enabled = status !== "Resolved" && status !== "Closed";
      const staleAfterHours =
        status === "New" ? newStatusHours[priority] : status === "Resolved" || status === "Closed" ? 72 : activeStatusHours[priority];

      return {
        status,
        priority,
        staleAfterHours,
        enabled
      };
    })
  );
}
