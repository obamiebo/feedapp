import { describe, expect, it } from "vitest";
import { calculateSlaDeadline, isSlaAtRisk, isSlaBreached } from "@/lib/sla";

describe("sla rules", () => {
  it("calculates resolution deadlines from policy", () => {
    const createdAt = new Date("2026-07-07T08:00:00.000Z");
    const deadline = calculateSlaDeadline(createdAt, {
      departmentId: "dept-1",
      priority: "High",
      responseTargetHours: 2,
      resolutionTargetHours: 10,
      escalationTargetHours: 5
    });

    expect(deadline.toISOString()).toBe("2026-07-07T18:00:00.000Z");
  });

  it("detects breached and at-risk cases", () => {
    expect(
      isSlaBreached(
        { status: "In Progress", slaDeadlineAt: new Date("2026-07-07T09:00:00.000Z") },
        new Date("2026-07-07T10:00:00.000Z")
      )
    ).toBe(true);

    expect(
      isSlaAtRisk(
        { status: "Assigned", slaDeadlineAt: new Date("2026-07-07T12:00:00.000Z") },
        new Date("2026-07-07T10:00:00.000Z"),
        4
      )
    ).toBe(true);
  });
});
