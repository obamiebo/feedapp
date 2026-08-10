import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import { resolveCurrentUser } from "@/lib/current-user";
import { createCaseService } from "@/services/cases";
import { POST } from "@/app/api/agent/actions/route";

vi.mock("@/lib/current-user", () => ({
  resolveCurrentUser: vi.fn()
}));

vi.mock("@/services/cases", () => ({
  createCaseService: vi.fn()
}));

vi.mock("@/repositories/audit-logs", () => ({
  createPrismaAuditLogRepository: vi.fn()
}));

const originalEnv = process.env;

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Customer Service"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/agent/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    FEEDBACK_AGENT_ENABLED: "true"
  };
  vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser());
  vi.mocked(createPrismaAuditLogRepository).mockReturnValue({
    createAuditLog: vi.fn().mockResolvedValue(undefined)
  });
  vi.mocked(createCaseService).mockReturnValue({
    transitionCaseForUser: vi.fn().mockResolvedValue({ id: "case-1", status: "Assigned" }),
    getCaseDetailForUser: vi.fn().mockResolvedValue({ id: "case-1", departmentId: "dept-1" }),
    assignCaseForUser: vi.fn().mockResolvedValue({ id: "case-1", assigneeId: "user-2" })
  } as never);
});

describe("/api/agent/actions", () => {
  it("confirms a transition action through the case service", async () => {
    const caseService = {
      transitionCaseForUser: vi.fn().mockResolvedValue({ id: "case-1", status: "Assigned" }),
      getCaseDetailForUser: vi.fn(),
      assignCaseForUser: vi.fn()
    };
    vi.mocked(createCaseService).mockReturnValue(caseService as never);

    const response = await POST(
      request({
        decision: "confirm",
        action: {
          id: "action-1",
          type: "transition_case",
          caseId: "case-1",
          toStatus: "Assigned",
          reason: "The case has an owner."
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(caseService.transitionCaseForUser).toHaveBeenCalledWith("case-1", "Assigned", expect.objectContaining({ id: "user-1" }));
    expect(body).toMatchObject({ status: "confirmed", result: { caseId: "case-1", status: "Assigned" } });
  });

  it("confirms an assignment action through the case service", async () => {
    const caseService = {
      transitionCaseForUser: vi.fn(),
      getCaseDetailForUser: vi.fn().mockResolvedValue({ id: "case-1", departmentId: "dept-1" }),
      assignCaseForUser: vi.fn().mockResolvedValue({ id: "case-1", assigneeId: "user-2" })
    };
    vi.mocked(createCaseService).mockReturnValue(caseService as never);

    const response = await POST(
      request({
        decision: "confirm",
        action: {
          id: "action-2",
          type: "assign_case",
          caseId: "case-1",
          assigneeId: "user-2",
          assigneeName: "Rep User",
          reason: "They are eligible for this product."
        }
      })
    );

    expect(response.status).toBe(200);
    expect(caseService.assignCaseForUser).toHaveBeenCalledWith("case-1", "user-2", "dept-1", expect.objectContaining({ id: "user-1" }));
  });

  it("audits dismissed actions without executing case changes", async () => {
    const caseService = {
      transitionCaseForUser: vi.fn(),
      getCaseDetailForUser: vi.fn(),
      assignCaseForUser: vi.fn()
    };
    const createAuditLog = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createCaseService).mockReturnValue(caseService as never);
    vi.mocked(createPrismaAuditLogRepository).mockReturnValue({ createAuditLog });

    const response = await POST(
      request({
        decision: "dismiss",
        action: {
          id: "action-3",
          type: "transition_case",
          caseId: "case-1",
          toStatus: "Assigned",
          reason: "Not ready."
        }
      })
    );

    expect(response.status).toBe(200);
    expect(caseService.transitionCaseForUser).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        caseId: "case-1",
        action: "agent.proposed_action_dismissed"
      })
    );
  });
});
