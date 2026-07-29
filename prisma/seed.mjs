import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { hash } from "argon2";

const prisma = new PrismaClient();

const roles = [
  ["admin", "Admin", "Full platform administration."],
  ["customer-service", "Customer Service", "Owns case intake, status updates, closure, and reopening."],
  ["product-manager", "Product Manager", "Coordinates case resolution and escalations."],
  ["department-user", "Product User", "Works on cases for products they can access."]
];

const departments = [
  ["dept-projects", "projects", "Projects"],
  ["dept-finance", "finance", "Finance"],
  ["dept-research", "research", "Research"]
];

const productGroups = [
  ["group-commerce", "commerce", "Commerce", "Customer-facing commerce and checkout products."],
  ["group-support", "support", "Support Channels", "Support forms and feedback channels."]
];

const users = [
  {
    id: "user-admin",
    email: "admin@example.com",
    name: "Platform Admin",
    ssoSubject: "sso-admin",
    provisioned: true,
    roleIds: ["admin"],
    departmentIds: ["dept-research", "dept-finance", "dept-projects"],
    productSourceIds: ["source-commerce-platform", "source-support-form", "source-product-api"],
    productGroupIds: ["group-commerce", "group-support"]
  },
  {
    id: "user-obamiebo-admin",
    email: "obamiebo@itconsortiumgh.com",
    name: "Obamiebo Admin",
    ssoSubject: "sso-obamiebo-admin",
    provisioned: true,
    roleIds: ["admin"],
    departmentIds: ["dept-research", "dept-finance", "dept-projects"],
    productSourceIds: ["source-commerce-platform", "source-support-form", "source-product-api"],
    productGroupIds: ["group-commerce", "group-support"]
  },
  {
    id: "user-cs-1",
    email: "service.rep@example.com",
    name: "Customer Service Rep",
    ssoSubject: "sso-cs-1",
    provisioned: true,
    roleIds: ["customer-service"],
    departmentIds: ["dept-research", "dept-finance", "dept-projects"],
    productSourceIds: ["source-commerce-platform", "source-support-form", "source-product-api"],
    productGroupIds: []
  },
  {
    id: "user-pm-1",
    email: "product.manager@example.com",
    name: "Product Manager",
    ssoSubject: "sso-pm-1",
    provisioned: true,
    roleIds: ["product-manager"],
    departmentIds: ["dept-research", "dept-projects"],
    productSourceIds: [],
    productGroupIds: ["group-commerce"]
  },
  {
    id: "user-dept-finance",
    email: "finance.rep@example.com",
    name: "Finance Department Rep",
    ssoSubject: "sso-finance-1",
    provisioned: true,
    roleIds: ["department-user"],
    departmentIds: ["dept-finance"],
    productSourceIds: ["source-commerce-platform"],
    productGroupIds: []
  },
  {
    id: "user-unprovisioned",
    email: "employee@example.com",
    name: "Unprovisioned Employee",
    ssoSubject: "sso-employee-1",
    provisioned: false,
    roleIds: [],
    departmentIds: [],
    productSourceIds: [],
    productGroupIds: []
  }
];

const customers = [
  {
    id: "customer-2001",
    externalId: "cust-commerce-2001",
    name: "Afi Mensah",
    email: "afi.mensah@example.com",
    phone: "+233200000001"
  },
  {
    id: "customer-2002",
    externalId: "cust-support-2002",
    name: "Kwame Boateng",
    email: "kwame.boateng@example.com",
    phone: "+233200000002"
  },
  {
    id: "customer-2003",
    externalId: "cust-product-2003",
    name: "Ama Owusu",
    email: "ama.owusu@example.com",
    phone: null
  }
];

const now = new Date();
const hoursFromNow = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);
const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const demoPassword = "Password123!";
const demoPasswordHash = await hash(demoPassword, { type: 2 });
const demoIntegrationSecret = "commerce-secret-123";
const demoIntegrationSecretHash = createHash("sha256").update(demoIntegrationSecret).digest("hex");

const messagingCadencePolicies = [
  ["NEW", "CRITICAL", 4, true],
  ["NEW", "HIGH", 8, true],
  ["NEW", "MEDIUM", 24, true],
  ["NEW", "LOW", 48, true],
  ["ASSIGNED", "CRITICAL", 24, true],
  ["ASSIGNED", "HIGH", 48, true],
  ["ASSIGNED", "MEDIUM", 72, true],
  ["ASSIGNED", "LOW", 96, true],
  ["IN_PROGRESS", "CRITICAL", 24, true],
  ["IN_PROGRESS", "HIGH", 48, true],
  ["IN_PROGRESS", "MEDIUM", 72, true],
  ["IN_PROGRESS", "LOW", 96, true],
  ["REOPENED", "CRITICAL", 24, true],
  ["REOPENED", "HIGH", 48, true],
  ["REOPENED", "MEDIUM", 72, true],
  ["REOPENED", "LOW", 96, true],
  ["RESOLVED", "CRITICAL", 72, false],
  ["RESOLVED", "HIGH", 72, false],
  ["RESOLVED", "MEDIUM", 72, false],
  ["RESOLVED", "LOW", 72, false],
  ["CLOSED", "CRITICAL", 72, false],
  ["CLOSED", "HIGH", 72, false],
  ["CLOSED", "MEDIUM", 72, false],
  ["CLOSED", "LOW", 72, false]
];

async function main() {
  for (const [id, name, description] of roles) {
    await prisma.role.upsert({
      where: { id },
      update: { name, description },
      create: { id, name, description }
    });
  }

  for (const [id, key, name] of departments) {
    await prisma.department.upsert({
      where: { id },
      update: { key, name },
      create: { id, key, name }
    });
  }

  for (const [id, key, name, description] of productGroups) {
    await prisma.productGroup.upsert({
      where: { id },
      update: { key, name, description },
      create: { id, key, name, description }
    });
  }

  const productSources = [
    {
      id: "source-commerce-platform",
      key: "commerce-platform",
      name: "Commerce Platform",
      type: "webhook",
      groupId: "group-commerce",
      secretHash: demoIntegrationSecretHash,
      config: {
        endpoint: "/api/ingestion/reports",
        sourceHeader: "x-feedback-source",
        secretHeader: "x-feedback-secret",
        defaultDepartmentKey: "finance"
      }
    },
    {
      id: "source-support-form",
      key: "support-form",
      name: "Support Form",
      type: "manual",
      groupId: "group-support",
      secretHash: null,
      config: {
        defaultDepartmentKey: "research"
      }
    },
    {
      id: "source-product-api",
      key: "product-api",
      name: "Product API",
      type: "api",
      groupId: "group-commerce",
      secretHash: null,
      config: {
        defaultDepartmentKey: "projects"
      }
    }
  ];

  for (const source of productSources) {
    await prisma.integrationSource.upsert({
      where: { key: source.key },
      update: {
        name: source.name,
        type: source.type,
        groupId: source.groupId,
        secretHash: source.secretHash,
        enabled: true,
        config: source.config
      },
      create: {
        id: source.id,
        key: source.key,
        name: source.name,
        type: source.type,
        groupId: source.groupId,
        secretHash: source.secretHash,
        enabled: true,
        config: source.config
      }
    });
  }

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        ssoSubject: user.ssoSubject,
        passwordHash: demoPasswordHash,
        passwordMustChange: false,
        provisioned: user.provisioned
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        ssoSubject: user.ssoSubject,
        passwordHash: demoPasswordHash,
        passwordMustChange: false,
        provisioned: user.provisioned
      }
    });

    for (const roleId of user.roleIds) {
      await prisma.roleAssignment.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId
        }
      });
    }

    for (const departmentId of user.departmentIds) {
      await prisma.departmentMember.upsert({
        where: {
          userId_departmentId: {
            userId: user.id,
            departmentId
          }
        },
        update: {},
        create: {
          userId: user.id,
          departmentId
        }
      });
    }

    for (const sourceId of user.productSourceIds) {
      await prisma.userProductAccess.upsert({
        where: {
          userId_sourceId: {
            userId: user.id,
            sourceId
          }
        },
        update: {},
        create: {
          userId: user.id,
          sourceId
        }
      });
    }

    for (const groupId of user.productGroupIds) {
      await prisma.userProductGroupAccess.upsert({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId
          }
        },
        update: {},
        create: {
          userId: user.id,
          groupId
        }
      });
    }
  }

  const slaPolicies = [
    ["dept-finance", "CRITICAL", 1, 8, 2],
    ["dept-finance", "HIGH", 2, 16, 6],
    ["dept-research", "MEDIUM", 4, 24, 12],
    ["dept-projects", "LOW", 8, 48, 24],
    ["dept-projects", "HIGH", 2, 24, 8]
  ];

  for (const [departmentId, priority, responseTargetHours, resolutionTargetHours, escalationTargetHours] of slaPolicies) {
    await prisma.slaPolicy.upsert({
      where: {
        departmentId_priority: {
          departmentId,
          priority
        }
      },
      update: {
        responseTargetHours,
        resolutionTargetHours,
        escalationTargetHours
      },
      create: {
        departmentId,
        priority,
        responseTargetHours,
        resolutionTargetHours,
        escalationTargetHours
      }
    });
  }

  for (const [status, priority, staleAfterHours, enabled] of messagingCadencePolicies) {
    await prisma.messagingCadencePolicy.upsert({
      where: {
        status_priority: {
          status,
          priority
        }
      },
      update: {
        staleAfterHours,
        enabled
      },
      create: {
        status,
        priority,
        staleAfterHours,
        enabled
      }
    });
  }

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: customer,
      create: customer
    });
  }

  const cases = [
    {
      id: "case-1001",
      title: "Customer cannot complete checkout",
      description: "Payment succeeds but the order confirmation never loads.",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      sourceSystem: "commerce-platform",
      externalId: "COM-8842",
      customerId: "customer-2001",
      departmentId: "dept-finance",
      assigneeId: "user-cs-1",
      createdAt: hoursAgo(6),
      dueAt: hoursFromNow(2),
      slaDeadlineAt: hoursFromNow(2)
    },
    {
      id: "case-1002",
      title: "Feedback on delivery notifications",
      description: "Customer says SMS delivery updates arrive late.",
      status: "ASSIGNED",
      priority: "MEDIUM",
      sourceSystem: "support-form",
      externalId: "SUP-1902",
      customerId: "customer-2002",
      departmentId: "dept-research",
      assigneeId: "user-cs-1",
      createdAt: hoursAgo(3),
      dueAt: hoursFromNow(18),
      slaDeadlineAt: hoursFromNow(18)
    },
    {
      id: "case-1003",
      title: "Product recommendation opportunity",
      description: "Customer reports limits in current package and may need an analytics add-on.",
      status: "NEW",
      priority: "LOW",
      sourceSystem: "product-api",
      externalId: "PROD-4471",
      customerId: "customer-2003",
      departmentId: "dept-projects",
      assigneeId: null,
      createdAt: hoursAgo(1.5),
      dueAt: hoursFromNow(46),
      slaDeadlineAt: hoursFromNow(46)
    }
  ];

  for (const feedbackCase of cases) {
    await prisma.case.upsert({
      where: {
        sourceSystem_externalId: {
          sourceSystem: feedbackCase.sourceSystem,
          externalId: feedbackCase.externalId
        }
      },
      update: feedbackCase,
      create: feedbackCase
    });

    const activeStage = await prisma.caseStage.findFirst({
      where: {
        caseId: feedbackCase.id,
        endedAt: null
      }
    });

    if (!activeStage) {
      await prisma.caseStage.create({
        data: {
          id: `stage-${feedbackCase.id}`,
          caseId: feedbackCase.id,
          status: feedbackCase.status,
          priority: feedbackCase.priority,
          startedAt: feedbackCase.createdAt
        }
      });
    }
  }

  await prisma.integrationSource.upsert({
    where: { key: "commerce-platform" },
    update: {
      name: "Commerce Platform",
      type: "webhook",
      secretHash: demoIntegrationSecretHash,
      enabled: true,
      groupId: "group-commerce",
      config: {
        endpoint: "/api/ingestion/reports",
        sourceHeader: "x-feedback-source",
        secretHeader: "x-feedback-secret",
        defaultDepartmentKey: "finance"
      }
    },
    create: {
      id: "source-commerce-platform",
      key: "commerce-platform",
      name: "Commerce Platform",
      type: "webhook",
      secretHash: demoIntegrationSecretHash,
      enabled: true,
      groupId: "group-commerce",
      config: {
        endpoint: "/api/ingestion/reports",
        sourceHeader: "x-feedback-source",
        secretHeader: "x-feedback-secret",
        defaultDepartmentKey: "finance"
      }
    }
  });

  await prisma.message.upsert({
    where: { id: "message-ack-1001" },
    update: {},
    create: {
      id: "message-ack-1001",
      caseId: "case-1001",
      channel: "EMAIL",
      direction: "outbound",
      approvalStatus: "APPROVED",
      providerMessageId: "seed-email-case-1001",
      body: "We have received your report and our team is reviewing it."
    }
  });

  await prisma.approval.upsert({
    where: { id: "approval-1003" },
    update: {},
    create: {
      id: "approval-1003",
      caseId: "case-1003",
      approverId: "user-pm-1",
      status: "PENDING",
      draftBody: "Based on your feedback, our team can review whether an analytics add-on would better support your reporting needs."
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: "user-admin",
      action: "seed.database",
      metadata: {
        roles: roles.length,
        departments: departments.length,
        productGroups: productGroups.length,
        productSources: productSources.length,
        users: users.length,
        customers: customers.length,
        cases: cases.length
      }
    }
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
