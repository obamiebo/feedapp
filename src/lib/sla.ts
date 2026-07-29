import type { FeedbackCase, SlaPolicy } from "@/domain/types";

export function calculateSlaDeadline(createdAt: Date, policy: SlaPolicy): Date {
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + policy.resolutionTargetHours);
  return deadline;
}

export function calculateResponseDeadline(createdAt: Date, policy: SlaPolicy): Date {
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + policy.responseTargetHours);
  return deadline;
}

export function isSlaBreached(feedbackCase: Pick<FeedbackCase, "slaDeadlineAt" | "status">, now = new Date()): boolean {
  if (!feedbackCase.slaDeadlineAt) return false;
  if (feedbackCase.status === "Resolved" || feedbackCase.status === "Closed") return false;
  return now.getTime() > feedbackCase.slaDeadlineAt.getTime();
}

export function isSlaAtRisk(
  feedbackCase: Pick<FeedbackCase, "slaDeadlineAt" | "status">,
  now = new Date(),
  riskWindowHours = 4
): boolean {
  if (!feedbackCase.slaDeadlineAt) return false;
  if (feedbackCase.status === "Resolved" || feedbackCase.status === "Closed") return false;

  const riskWindowMs = riskWindowHours * 60 * 60 * 1000;
  const timeRemaining = feedbackCase.slaDeadlineAt.getTime() - now.getTime();
  return timeRemaining > 0 && timeRemaining <= riskWindowMs;
}
