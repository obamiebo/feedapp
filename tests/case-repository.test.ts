import { describe, expect, it, vi } from "vitest";
import { createPrismaCaseRepository } from "@/repositories/cases";

describe("case repository", () => {
  it("combines free-text search and on-track SLA filters with AND", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = createPrismaCaseRepository({
      case: {
        findMany
      }
    } as never);

    await repository.listCases({
      search: "checkout",
      slaState: "on-track"
    });

    const where = findMany.mock.calls[0][0].where;

    expect(where.OR).toBeUndefined();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              title: { contains: "checkout", mode: "insensitive" }
            })
          ])
        }),
        expect.objectContaining({
          OR: expect.arrayContaining([
            { status: { in: ["RESOLVED", "CLOSED"] } },
            { slaDeadlineAt: null },
            expect.objectContaining({ slaDeadlineAt: expect.objectContaining({ gt: expect.any(Date) }) })
          ])
        })
      ])
    );
  });

  it("applies pagination and user visibility in the database query", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(24);
    const repository = createPrismaCaseRepository({
      case: {
        count,
        findMany
      }
    } as never);

    const page = await repository.listCasesPage(
      {
        search: "checkout",
        page: 2,
        pageSize: 10
      },
      {
        id: "user-cs-1",
        email: "cs@example.com",
        name: "Customer Service",
        roles: ["Customer Service"],
        departmentIds: ["dept-finance"],
        directProductSourceKeys: ["commerce-platform"],
        productSourceKeys: ["commerce-platform"],
        productGroupIds: [],
        assignedCaseIds: ["case-1"],
        provisioned: true
      }
    );

    const where = findMany.mock.calls[0][0].where;

    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 10,
        take: 10
      })
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([{ assigneeId: "user-cs-1" }, { sourceSystem: { in: ["commerce-platform"] } }])
        })
      ])
    );
    expect(page).toEqual({
      items: [],
      total: 24,
      page: 2,
      pageSize: 10,
      pageCount: 3
    });
  });

  it("does not grant case visibility to admin-only users", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = createPrismaCaseRepository({
      case: {
        count,
        findMany
      }
    } as never);

    await repository.listCasesPage(
      {
        page: 1,
        pageSize: 10
      },
      {
        id: "user-admin",
        email: "admin@example.com",
        name: "Admin",
        roles: ["Admin"],
        departmentIds: [],
        directProductSourceKeys: [],
        productSourceKeys: [],
        productGroupIds: [],
        assignedCaseIds: [],
        provisioned: true
      }
    );

    const where = findMany.mock.calls[0][0].where;

    expect(where.AND).toEqual([{
      id: "__no_visible_cases__"
    }]);
  });
});
