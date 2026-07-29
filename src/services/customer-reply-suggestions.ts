import type { CaseDetail } from "@/repositories/cases";

export function suggestCustomerReply(caseDetail: CaseDetail, options: { staleFollowUp?: boolean } = {}): string {
  const greetingName = caseDetail.customer.name?.trim();
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const reference = `Thank you for contacting us about "${caseDetail.title}".`;

  if (options.staleFollowUp) {
    return [
      greeting,
      "",
      `We wanted to share an update on "${caseDetail.title}".`,
      `Your report is still active with our ${caseDetail.departmentName} team, and we are continuing to work through it.`,
      "We do not want to close this until the team has completed the necessary review.",
      "We will send another update as soon as there is meaningful progress.",
      "",
      "Thank you for your patience."
    ].join("\n");
  }

  const statusLine =
    caseDetail.status === "Resolved"
      ? "We have marked this case as resolved based on the latest update from our team."
      : caseDetail.status === "Closed"
        ? "This case has now been closed after our latest review."
        : caseDetail.status === "In Progress"
          ? "Our team is actively working on this and will continue tracking progress internally."
          : caseDetail.status === "Assigned"
            ? `Your report has been assigned to our ${caseDetail.departmentName} team for review.`
            : "We have received your report and are reviewing the details.";

  const nextStep =
    caseDetail.status === "Resolved" || caseDetail.status === "Closed"
      ? "If anything still does not look right, please reply to this message and we will reopen the case."
      : "We will send another update as soon as there is meaningful progress.";

  return [greeting, "", reference, statusLine, nextStep, "", "Thank you."].join("\n");
}
