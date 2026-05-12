import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/prismaClient.js';
import bcrypt from 'bcrypt';

async function main() {
  // Owner
  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@example.com';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'ChangeMe123!';

  const ownerExists = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!ownerExists) {
    const hashedOwner = await bcrypt.hash(ownerPassword, 10);
    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        password: hashedOwner,
        name: 'Owner',
        role: 'OWNER',
        accountStatus: 'ACTIVE',
      },
    });
    console.log('Seed: owner created', owner.email);
  } else {
    console.log('Seed: owner already exists');
  }

  // Optional Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminExists) {
      const hashedAdmin = await bcrypt.hash(adminPassword, 10);
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedAdmin,
          name: 'Admin',
          role: 'ADMIN',
          accountStatus: 'ACTIVE',
        },
      });
      console.log('Seed: admin created', admin.email);
    } else {
      console.log('Seed: admin already exists');
    }
  } else {
    console.log('Seed: admin skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to enable)');
  }

  // Demo student (ACTIVE — can sign in for testing)
  const studentEmail = process.env.SEED_STUDENT_EMAIL || 'student@example.com';
  const studentPassword = process.env.SEED_STUDENT_PASSWORD || 'Student123!';
  const studentExists = await prisma.user.findUnique({ where: { email: studentEmail } });
  if (!studentExists) {
    const hashed = await bcrypt.hash(studentPassword, 10);
    await prisma.user.create({
      data: {
        email: studentEmail,
        password: hashed,
        name: 'Demo Student',
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
      },
    });
    console.log('Seed: demo student created', studentEmail);
  } else {
    await prisma.user.updateMany({
      where: { email: studentEmail },
      data: { accountStatus: 'ACTIVE' },
    });
    console.log('Seed: demo student already exists (ensured ACTIVE)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
