import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    roles,
    departments,
    users,
    customers,
    cases,
    caseStages,
    slaPolicies,
    messagingCadencePolicies,
    productGroups,
    integrationSources,
    productAccess,
    productGroupAccess,
    messages,
    approvals,
    auditLogs
  ] =
    await Promise.all([
      prisma.role.count(),
      prisma.department.count(),
      prisma.user.count(),
      prisma.customer.count(),
      prisma.case.count(),
      prisma.caseStage.count(),
      prisma.slaPolicy.count(),
      prisma.messagingCadencePolicy.count(),
      prisma.productGroup.count(),
      prisma.integrationSource.count(),
      prisma.userProductAccess.count(),
      prisma.userProductGroupAccess.count(),
      prisma.message.count(),
      prisma.approval.count(),
      prisma.auditLog.count()
    ]);

  const counts = {
    roles,
    departments,
    users,
    customers,
    cases,
    caseStages,
    slaPolicies,
    messagingCadencePolicies,
    productGroups,
    integrationSources,
    productAccess,
    productGroupAccess,
    messages,
    approvals,
    auditLogs
  };

  const expectedMinimums = {
    roles: 4,
    departments: 3,
    users: 5,
    customers: 3,
    cases: 3,
    caseStages: 3,
    slaPolicies: 5,
    messagingCadencePolicies: 24,
    productGroups: 2,
    integrationSources: 3,
    productAccess: 6,
    productGroupAccess: 3,
    messages: 1,
    approvals: 1,
    auditLogs: 1
  };

  const failures = Object.entries(expectedMinimums).filter(([key, minimum]) => counts[key] < minimum);

  console.table(counts);

  if (failures.length > 0) {
    throw new Error(
      `Seed verification failed: ${failures.map(([key, minimum]) => `${key} expected >= ${minimum}, got ${counts[key]}`).join("; ")}`
    );
  }

  console.log("Seed verification passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
