import type { caseStatuses, messageChannels, priorities, roles } from "./constants";

export type CaseStatus = (typeof caseStatuses)[number];
export type Priority = (typeof priorities)[number];
export type Role = (typeof roles)[number];
export type MessageChannel = (typeof messageChannels)[number];

export type AppUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  departmentIds: string[];
  directProductSourceKeys: string[];
  productSourceKeys: string[];
  productGroupIds: string[];
  assignedCaseIds?: string[];
  provisioned: boolean;
  passwordMustChange?: boolean;
};

export type FeedbackCase = {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: Priority;
  departmentId: string;
  productSourceKey?: string;
  productGroupId?: string;
  assigneeId?: string;
  customerId: string;
  sourceSystem: string;
  externalId?: string;
  dueAt?: Date;
  slaDeadlineAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SlaPolicy = {
  departmentId: string;
  priority: Priority;
  responseTargetHours: number;
  resolutionTargetHours: number;
  escalationTargetHours: number;
};

export type IngestionReport = {
  sourceSystem: string;
  externalId: string;
  title: string;
  description: string;
  priority: Priority;
  departmentKey?: string;
  customer: {
    externalId?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  reportedAt?: string;
  rawPayload?: unknown;
};
