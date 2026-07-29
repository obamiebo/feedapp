import type { CaseStatus } from "@/domain/types";

const transitions: Record<CaseStatus, CaseStatus[]> = {
  New: ["Assigned", "Closed"],
  Assigned: ["In Progress", "Resolved", "Closed"],
  "In Progress": ["Resolved", "Assigned", "Closed"],
  Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["Assigned", "In Progress", "Resolved", "Closed"]
};

export function getAllowedTransitions(status: CaseStatus): CaseStatus[] {
  return transitions[status];
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return transitions[from].includes(to);
}

export function assertValidTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid case transition from ${from} to ${to}`);
  }
}
