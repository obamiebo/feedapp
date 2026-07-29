import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createPrismaCustomerRepository } from "@/repositories/customers";

const existingCustomer = {
  id: "customer-1",
  externalId: "external-1",
  name: "Existing Customer",
  email: "customer@example.com",
  phone: "+233200000001"
};

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["email"] }
  });
}

describe("customer repository", () => {
  it("reuses an existing customer by any provided identifier", async () => {
    const findFirst = vi.fn().mockResolvedValue(existingCustomer);
    const create = vi.fn();
    const repository = createPrismaCustomerRepository({
      customer: {
        findFirst,
        create
      }
    } as never);

    const customer = await repository.findOrCreateCustomer({
      externalId: "external-1",
      email: "ignored@example.com",
      phone: "+233200000001"
    });

    expect(customer).toBe(existingCustomer);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ externalId: "external-1" }, { email: "ignored@example.com" }, { phone: "+233200000001" }]
        }
      })
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("normalizes identifiers before searching and creating", async () => {
    const createdCustomer = {
      id: "customer-created",
      externalId: "external-1",
      name: "New Customer",
      email: "new.customer@example.com",
      phone: "+233200000002"
    };
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue(createdCustomer);
    const repository = createPrismaCustomerRepository({
      customer: {
        findFirst,
        create
      }
    } as never);

    const customer = await repository.findOrCreateCustomer({
      externalId: " external-1 ",
      name: " New Customer ",
      email: " New.Customer@Example.COM ",
      phone: " +233200000002 "
    });

    expect(customer).toBe(createdCustomer);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ externalId: "external-1" }, { email: "new.customer@example.com" }, { phone: "+233200000002" }]
        }
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          externalId: "external-1",
          name: "New Customer",
          email: "new.customer@example.com",
          phone: "+233200000002"
        }
      })
    );
  });

  it("re-queries and returns the existing customer after a unique conflict race", async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingCustomer);
    const create = vi.fn().mockRejectedValue(uniqueConflict());
    const repository = createPrismaCustomerRepository({
      customer: {
        findFirst,
        create
      }
    } as never);

    const customer = await repository.findOrCreateCustomer({
      email: "customer@example.com"
    });

    expect(customer).toBe(existingCustomer);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("rethrows a unique conflict when the conflicting customer cannot be found", async () => {
    const error = uniqueConflict();
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockRejectedValue(error);
    const repository = createPrismaCustomerRepository({
      customer: {
        findFirst,
        create
      }
    } as never);

    await expect(
      repository.findOrCreateCustomer({
        email: "customer@example.com"
      })
    ).rejects.toBe(error);
  });
});
