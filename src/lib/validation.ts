import { z } from "zod";
import { caseStatuses, messageChannels, priorities } from "@/domain/constants";

export const createCaseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  priority: z.enum(priorities),
  departmentId: z.string().min(1),
  customerId: z.string().min(1),
  sourceSystem: z.string().min(1).default("manual")
});

export const createManualCaseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  priority: z.enum(priorities),
  sourceSystem: z.string().min(1),
  assigneeId: z.string().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerExternalId: z.string().optional()
});

export const ingestionReportSchema = z.object({
  sourceSystem: z.string().min(1),
  externalId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3),
  priority: z.enum(priorities),
  departmentKey: z.string().min(1).optional(),
  customer: z.object({
    externalId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional()
  }),
  reportedAt: z.string().datetime().optional(),
  rawPayload: z.unknown().optional()
});

export const statusUpdateSchema = z.object({
  status: z.enum(caseStatuses),
  note: z.string().optional()
});

export const internalNoteSchema = z.object({
  caseId: z.string().min(1),
  body: z.string().min(3)
});

export const customerReplyApprovalSchema = z.object({
  caseId: z.string().min(1),
  channel: z.enum(messageChannels).refine((channel) => channel !== "Internal Note", {
    message: "Customer replies must use Email or SMS"
  }),
  draftBody: z.string().min(3)
});
