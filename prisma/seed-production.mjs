import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

const roles = [
  ["admin", "Admin", "Full platform administration."],
  ["customer-service", "Customer Service", "Owns case intake, status updates, closure, and reopening."],
  ["product-manager", "Product Manager", "Coordinates case resolution and escalations."],
  ["department-user", "Product User", "Works on cases for products they can access."]
];

const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || "obamiebo@itconsortiumgh.com";
const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Obamiebo Admin";
const temporaryPassword = process.env.SEED_ADMIN_TEMP_PASSWORD;

if (!temporaryPassword || temporaryPassword.length < 10) {
  throw new Error("SEED_ADMIN_TEMP_PASSWORD must be set to at least 10 characters");
}

async function main() {
  const passwordHash = await hash(temporaryPassword, { type: 2 });

  for (const [id, name, description] of roles) {
    await prisma.role.upsert({
      where: { id },
      update: { name, description },
      create: { id, name, description }
    });
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: {
      id: true,
      passwordHash: true
    }
  });

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          name: adminName,
          provisioned: true,
          ...(existingAdmin.passwordHash
            ? {}
            : {
                passwordHash,
                passwordMustChange: true
              })
        }
      })
    : await prisma.user.create({
        data: {
          id: "user-obamiebo-admin",
          email: adminEmail,
          name: adminName,
          passwordHash,
          passwordMustChange: true,
          provisioned: true
        }
      });

  await prisma.roleAssignment.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: "admin"
      }
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: "admin"
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "admin.production_seed_applied",
      metadata: {
        adminEmail,
        existingUser: Boolean(existingAdmin),
        temporaryPasswordApplied: !existingAdmin?.passwordHash,
        roles: roles.length
      }
    }
  });

  console.log(`Production seed complete for ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
