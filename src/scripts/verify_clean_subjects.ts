import { PrismaClient } from '@prisma/client';

const URL = 'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

async function verify() {
  const subjects = await prisma.subject.findMany({
    include: {
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`\n========================================`);
  console.log(`TOTAL ACTIVE SUBJECTS IN SUPABASE CLOUD: ${subjects.length}`);
  console.log(`========================================\n`);

  for (const s of subjects) {
    console.log(`📌 Subject: "${s.name}" ➔ ${s._count.questions} Questions`);
  }

  await prisma.$disconnect();
}

verify();
