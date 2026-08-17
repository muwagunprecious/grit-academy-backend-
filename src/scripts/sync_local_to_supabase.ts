import { PrismaClient } from '@prisma/client';

const LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/grit_academy?schema=public';
const SUPABASE_DB_URL = 'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:5432/postgres';

const localPrisma = new PrismaClient({
  datasources: { db: { url: LOCAL_DB_URL } },
});

const supabasePrisma = new PrismaClient({
  datasources: { db: { url: SUPABASE_DB_URL } },
});

async function syncLocalToSupabase() {
  console.log('🚀 Starting Full Migration from Local PostgreSQL to Supabase Cloud...\n');

  try {
    // 1. Fetch local data
    console.log('📦 Reading data from local database...');
    const combinations = await localPrisma.subjectCombination.findMany();
    const subjects = await localPrisma.subject.findMany();
    const users = await localPrisma.gritUser.findMany();
    const pdfs = await localPrisma.pdfDocument.findMany();
    const questions = await localPrisma.question.findMany();
    const tests = await localPrisma.test.findMany();
    const testQuestions = await localPrisma.testQuestion.findMany();

    console.log(`   - Found ${combinations.length} Subject Combinations`);
    console.log(`   - Found ${subjects.length} Subjects`);
    console.log(`   - Found ${users.length} GritUsers`);
    console.log(`   - Found ${pdfs.length} PDF Documents`);
    console.log(`   - Found ${questions.length} Questions`);
    console.log(`   - Found ${tests.length} Tests`);
    console.log(`   - Found ${testQuestions.length} TestQuestions\n`);

    // 2. Sync Subject Combinations
    console.log('🔄 Syncing Subject Combinations to Supabase...');
    for (const item of combinations) {
      await supabasePrisma.subjectCombination.upsert({
        where: { id: item.id },
        update: item,
        create: item,
      });
    }

    // 3. Sync Subjects
    console.log('🔄 Syncing Subjects to Supabase...');
    for (const item of subjects) {
      await supabasePrisma.subject.upsert({
        where: { id: item.id },
        update: item,
        create: item,
      });
    }

    // 4. Sync GritUsers
    console.log('🔄 Syncing Users to Supabase...');
    for (const item of users) {
      await supabasePrisma.gritUser.upsert({
        where: { id: item.id },
        update: item,
        create: item,
      });
    }

    // 5. Sync PDF Documents
    console.log('🔄 Syncing PDF Documents to Supabase...');
    for (const item of pdfs) {
      await supabasePrisma.pdfDocument.upsert({
        where: { id: item.id },
        update: item,
        create: item,
      });
    }

    // 6. Sync Questions in bulk
    console.log('🔄 Bulk Syncing 1,097 Questions to Supabase...');
    const BATCH_SIZE = 250;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const chunk = questions.slice(i, i + BATCH_SIZE);
      await supabasePrisma.question.createMany({
        data: chunk as any,
        skipDuplicates: true,
      });
      console.log(`   Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)} (${Math.min(i + BATCH_SIZE, questions.length)}/${questions.length} questions)`);
    }

    // 7. Sync Tests
    console.log('🔄 Syncing Tests to Supabase...');
    await supabasePrisma.test.createMany({
      data: tests,
      skipDuplicates: true,
    });

    // 8. Sync TestQuestions
    console.log('🔄 Syncing TestQuestions to Supabase...');
    await supabasePrisma.testQuestion.createMany({
      data: testQuestions,
      skipDuplicates: true,
    });

    console.log('\n========================================================');
    console.log('🎉 SUCCESS! ALL LOCAL DATABASE DATA PUSHED TO SUPABASE!');
    console.log('========================================================\n');
  } catch (error: any) {
    console.error('❌ Error during Supabase migration:', error);
    process.exit(1);
  } finally {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

syncLocalToSupabase();
