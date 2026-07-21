import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default admin user
  const adminEmail = 'admin@gritacademy.com';
  const existingAdmin = await prisma.gritUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    await prisma.gritUser.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Grit',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✅ Created default admin account (admin@gritacademy.com / Admin@123)');
  } else {
    console.log('ℹ️ Admin user already exists, skipping...');
  }

  // Create subject combinations and subjects
  const combinations = [
    {
      name: 'Science',
      description: 'Science subject combination for engineering, medicine, and other natural science fields.',
      icon: 'Beaker',
      subjects: ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology'],
    },
    {
      name: 'Art',
      description: 'Art subject combination for law, mass communication, and humanities.',
      icon: 'Palette',
      subjects: ['English', 'Literature', 'Government', 'CRS'],
    },
    {
      name: 'Commercial',
      description: 'Commercial subject combination for accounting, economics, and business management.',
      icon: 'Coins',
      subjects: ['English', 'Economics', 'Commerce', 'Accounting', 'Government'],
    },
  ];

  for (const comb of combinations) {
    const dbComb = await prisma.subjectCombination.upsert({
      where: { name: comb.name },
      update: {
        description: comb.description,
        icon: comb.icon,
      },
      create: {
        name: comb.name,
        description: comb.description,
        icon: comb.icon,
      },
    });

    console.log(`✅ Upserted combination: ${comb.name}`);

    for (const subName of comb.subjects) {
      await prisma.subject.upsert({
        where: {
          name_combinationId: {
            name: subName,
            combinationId: dbComb.id,
          },
        },
        update: {},
        create: {
          name: subName,
          combinationId: dbComb.id,
        },
      });
    }
    console.log(`   └─ Upserted subjects for ${comb.name}`);
  }

  // Create default achievements
  const achievements = [
    {
      name: 'First Steps',
      description: 'Completed your first practice CBT exam.',
      icon: 'Award',
      criteria: { type: 'attempts_count', threshold: 1 },
    },
    {
      name: 'Perfect Score',
      description: 'Scored 100% on any practice exam.',
      icon: 'Zap',
      criteria: { type: 'percentage', threshold: 100 },
    },
    {
      name: 'Consistent Learner',
      description: 'Completed 5 practice exams.',
      icon: 'Clock',
      criteria: { type: 'attempts_count', threshold: 5 },
    },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { name: ach.name },
      update: {
        description: ach.description,
        icon: ach.icon,
        criteria: ach.criteria,
      },
      create: {
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        criteria: ach.criteria,
      },
    });
  }
  console.log('✅ Upserted badges and achievements');

  // Create default settings
  const settings = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'theme', value: 'light' },
    { key: 'registration_enabled', value: 'true' },
  ];

  for (const set of settings) {
    await prisma.setting.upsert({
      where: { key: set.key },
      update: {},
      create: {
        key: set.key,
        value: set.value,
      },
    });
  }
  console.log('✅ Upserted default settings');

  console.log('🌱 Seeding process completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
