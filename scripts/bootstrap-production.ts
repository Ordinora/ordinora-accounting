import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const prisma = new PrismaClient();

const input = z.object({
  firmName: z.string().trim().min(2).max(160),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(14).max(200),
}).parse({
  firmName: process.env.BOOTSTRAP_FIRM_NAME,
  adminName: process.env.BOOTSTRAP_ADMIN_NAME,
  adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
  adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
});

async function main() {
  const [firmCount, userCount] = await Promise.all([prisma.firm.count(), prisma.user.count()]);
  if (firmCount || userCount) {
    throw new Error("Bootstrap refused because the database already contains a firm or user.");
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 12);
  await prisma.$transaction(async (tx) => {
    const firm = await tx.firm.create({ data: { name: input.firmName } });
    const administrator = await tx.user.create({
      data: {
        firmId: firm.id,
        kind: "STAFF",
        email: input.adminEmail,
        displayName: input.adminName,
        passwordHash,
        staffRole: "FIRM_ADMIN",
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId: firm.id,
        actorId: administrator.id,
        actorKind: "STAFF",
        action: "PRODUCTION_BOOTSTRAPPED",
        entityType: "Firm",
        entityId: firm.id,
        newValues: { administratorEmail: input.adminEmail },
      },
    });
  });

  console.log("Production firm administrator created successfully.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Production bootstrap failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
