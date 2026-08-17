import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedStudent() {
  const passwordHash = await bcrypt.hash('Student@123', 10);

  const student = await prisma.gritUser.upsert({
    where: { email: 'student@gritacademy.com' },
    update: {
      password: passwordHash,
      role: 'STUDENT',
    },
    create: {
      email: 'student@gritacademy.com',
      password: passwordHash,
      firstName: 'CBT',
      lastName: 'Student',
      role: 'STUDENT',
    },
  });

  console.log('\n=====================================');
  console.log('✅ STUDENT ACCOUNT CREATED / READY:');
  console.log(`- Email: ${student.email}`);
  console.log('- Password: Student@123');
  console.log(`- Role: ${student.role}`);
  console.log('=====================================\n');
}

seedStudent().catch(console.error).finally(() => prisma.$disconnect());
