import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DepartmentSummary = {
  id: string;
  key: string;
  name: string;
};

export type DepartmentRepository = {
  listDepartments(): Promise<DepartmentSummary[]>;
};

export function createPrismaDepartmentRepository(client: PrismaClient = prisma): DepartmentRepository {
  return {
    listDepartments() {
      return client.department.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          key: true,
          name: true
        }
      });
    }
  };
}
