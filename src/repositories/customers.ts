import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CustomerSummary = {
  id: string;
  externalId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type CreateCustomerRecord = {
  externalId?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export type CustomerRepository = {
  findOrCreateCustomer(input: CreateCustomerRecord): Promise<CustomerSummary>;
};

const customerSelect = {
  id: true,
  externalId: true,
  name: true,
  email: true,
  phone: true
} as const;

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeEmail(value: string | undefined) {
  return normalizeOptional(value)?.toLowerCase();
}

function normalizeInput(input: CreateCustomerRecord): CreateCustomerRecord {
  return {
    externalId: normalizeOptional(input.externalId),
    name: normalizeOptional(input.name),
    email: normalizeEmail(input.email),
    phone: normalizeOptional(input.phone)
  };
}

function identifierWhere(input: CreateCustomerRecord): Prisma.CustomerWhereInput | undefined {
  const identifiers: Prisma.CustomerWhereInput[] = [
    ...(input.externalId ? [{ externalId: input.externalId }] : []),
    ...(input.email ? [{ email: input.email }] : []),
    ...(input.phone ? [{ phone: input.phone }] : [])
  ];

  return identifiers.length > 0 ? { OR: identifiers } : undefined;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function createPrismaCustomerRepository(client: PrismaClient = prisma): CustomerRepository {
  async function findExistingCustomer(input: CreateCustomerRecord) {
    const where = identifierWhere(input);

    if (!where) {
      return null;
    }

    return client.customer.findFirst({
      where,
      select: customerSelect
    });
  }

  return {
    async findOrCreateCustomer(input) {
      const normalizedInput = normalizeInput(input);
      const existing = await findExistingCustomer(normalizedInput);

      if (existing) {
        return existing;
      }

      try {
        return await client.customer.create({
          data: normalizedInput,
          select: customerSelect
        });
      } catch (error) {
        if (!isUniqueConflict(error)) {
          throw error;
        }

        const existingAfterConflict = await findExistingCustomer(normalizedInput);

        if (!existingAfterConflict) {
          throw error;
        }

        return existingAfterConflict;
      }
    }
  };
}
