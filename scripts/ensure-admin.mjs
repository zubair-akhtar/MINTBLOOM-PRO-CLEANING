/**
 * Upsert a verified admin user for local or production DB.
 * Usage:
 *   node scripts/ensure-admin.mjs
 *   # or with env:
 *   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/ensure-admin.mjs
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

const email = (process.env.ADMIN_EMAIL || process.env.POLSIA_OWNER_EMAIL || 'owner@mintbloom.local')
  .trim()
  .toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'MintbloomLocal1!';
const name = process.env.ADMIN_NAME || 'Mintbloom Admin';

async function main() {
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const hashed = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  let userId;
  if (existing) {
    userId = existing.id;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        role: 'admin',
        emailVerified: true,
      },
    });
    const account = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: 'credential' },
    });
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hashed, updatedAt: new Date() },
      });
    } else {
      const now = new Date();
      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          accountId: existing.id,
          providerId: 'credential',
          userId: existing.id,
          password: hashed,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    console.log(`Updated admin: ${email}`);
  } else {
    const id = crypto.randomUUID();
    const now = new Date();
    userId = id;
    await prisma.user.create({
      data: {
        id,
        name,
        email,
        emailVerified: true,
        role: 'admin',
        createdAt: now,
        updatedAt: now,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: id,
            providerId: 'credential',
            password: hashed,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    });
    console.log(`Created admin: ${email}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  console.log(
    JSON.stringify(
      {
        email: user?.email,
        role: user?.role,
        emailVerified: user?.emailVerified,
        passwordSet: true,
      },
      null,
      2,
    ),
  );
  console.log('\nLogin at /login with the email above and ADMIN_PASSWORD (default MintbloomLocal1!).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
