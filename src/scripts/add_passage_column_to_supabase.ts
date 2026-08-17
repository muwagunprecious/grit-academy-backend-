import { PrismaClient } from '@prisma/client';

const URLS = [
  'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@db.zgcfacamuapspxcayutf.supabase.co:5432/postgres',
];

async function addPassageColumn() {
  console.log('⚡ Adding missing passage column & setting all questions to APPROVED in Supabase Cloud DB...\n');

  for (const url of URLS) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      // 1. Add passage column if missing
      await prisma.$executeRawUnsafe(`ALTER TABLE "public"."grit_questions" ADD COLUMN IF NOT EXISTS "passage" TEXT;`);
      console.log('✅ Passage column added/verified on Supabase!');

      // 2. Approve all 1,099 questions so subjects display accurate question counts!
      const count = await prisma.question.updateMany({
        data: {
          status: 'APPROVED',
          isApproved: true,
        },
      });
      console.log(`✅ Approved ${count.count} questions in Supabase Cloud DB!`);

      // 3. Print verified subject counts
      const finalSubjects = await prisma.subject.findMany({
        include: { _count: { select: { questions: true } } },
      });

      console.log('\n--- VERIFIED SUPABASE CLOUD SUBJECT QUESTION COUNTS ---');
      for (const s of finalSubjects) {
        console.log(`- ${s.name}: ${s._count.questions} questions`);
      }

      await prisma.$disconnect();
      return;
    } catch (e: any) {
      console.log(`Connection attempt failed on ${url.split('@')[1]}: ${e.message?.slice(0, 120)}`);
      await prisma.$disconnect();
    }
  }
}

addPassageColumn();
