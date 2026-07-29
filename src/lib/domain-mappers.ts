import type { CaseStatus as PrismaCaseStatus, Priority as PrismaPriority } from "@prisma/client";
import type { CaseStatus, Priority } from "@/domain/types";

const caseStatusFromPrisma: Record<PrismaCaseStatus, CaseStatus> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened"
};

const caseStatusToPrisma: Record<CaseStatus, PrismaCaseStatus> = {
  New: "NEW",
  Assigned: "ASSIGNED",
  "In Progress": "IN_PROGRESS",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
  Reopened: "REOPENED"
};

const priorityFromPrisma: Record<PrismaPriority, Priority> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical"
};

const priorityToPrisma: Record<Priority, PrismaPriority> = {
  Low: "LOW",
  Medium: "MEDIUM",
  High: "HIGH",
  Critical: "CRITICAL"
};

export function mapCaseStatusFromPrisma(status: PrismaCaseStatus): CaseStatus {
  return caseStatusFromPrisma[status];
}

export function mapCaseStatusToPrisma(status: CaseStatus): PrismaCaseStatus {
  return caseStatusToPrisma[status];
}

export function mapPriorityFromPrisma(priority: PrismaPriority): Priority {
  return priorityFromPrisma[priority];
}

export function mapPriorityToPrisma(priority: Priority): PrismaPriority {
  return priorityToPrisma[priority];
}
