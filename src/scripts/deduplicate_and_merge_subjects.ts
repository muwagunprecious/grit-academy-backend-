import { PrismaClient } from '@prisma/client';

const URL = 'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:6543/postgres';
const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

async function deduplicateSubjects() {
  console.log('🔍 Inspecting subjects in Supabase Cloud DB...\n');

  const allSubjects = await prisma.subject.findMany({
    include: {
      _count: {
        select: { questions: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Total subject records found in DB: ${allSubjects.length}`);
  for (const s of allSubjects) {
    console.log(`- ID: ${s.id} | Name: "${s.name}" | Questions: ${s._count.questions}`);
  }

  // Group by trimmed case-insensitive name
  const nameMap = new Map<string, typeof allSubjects>();

  for (const s of allSubjects) {
    const key = s.name.trim().toLowerCase();
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(s);
  }

  console.log('\n⚡ Merging duplicate subjects...\n');

  for (const [cleanName, list] of nameMap.entries()) {
    if (list.length > 1) {
      console.log(`Found ${list.length} duplicates for "${cleanName}":`);

      // Sort by questions count descending so the one with most questions is primary
      list.sort((a, b) => b._count.questions - a._count.questions);
      const primary = list[0];
      const duplicates = list.slice(1);

      console.log(`  -> Main subject to keep: ID ${primary.id} ("${primary.name}") [currently ${primary._count.questions} Qs]`);

      for (const dup of duplicates) {
        console.log(`  -> Moving questions from duplicate ID ${dup.id} ("${dup.name}") [${dup._count.questions} Qs] to ${primary.id}...`);

        // Update all questions referencing dup.id to primary.id
        const moved = await prisma.question.updateMany({
          where: { subjectId: dup.id },
          data: { subjectId: primary.id },
        });

        console.log(`     Re-linked ${moved.count} questions.`);

        // Delete duplicate subject record
        try {
          await prisma.subject.delete({
            where: { id: dup.id }
          });
          console.log(`     Deleted duplicate subject ID ${dup.id}`);
        } catch (e: any) {
          console.log(`     Could not delete ${dup.id}: ${e.message?.slice(0, 100)}`);
        }
      }
    }
  }

  console.log('\n--- CLEANED SUBJECTS RESULT ---');
  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
    orderBy: { name: 'asc' }
  });

  for (const s of finalSubjects) {
    console.log(`✅ Subject: "${s.name}" | Total Questions: ${s._count.questions}`);
  }

  await prisma.$disconnect();
}

deduplicateSubjects();
