import prisma from '../lib/prisma.js';

async function cleanup() {
  console.log('🧹 Cleaning advert questions and restoring exact domain subjects...\n');

  // 1. Delete PDF Advertisement questions (like "Timely Delivery of Services offers services in...")
  const deleted = await prisma.question.deleteMany({
    where: {
      text: {
        contains: 'Timely Delivery of Services',
      },
    },
  });
  console.log(`Deleted ${deleted.count} PDF advertisement questions.`);

  // 2. Restore Hausa-Fulani to Government
  const govtSub = await prisma.subject.findFirst({ where: { name: 'Government' } });
  if (govtSub) {
    await prisma.question.updateMany({
      where: { text: { contains: 'Hausa-Fulani' } },
      data: { subjectId: govtSub.id, topic: 'Government Past Questions' },
    });
  }

  // 3. Restore HCl / mol dm-3 to Chemistry
  const chemSub = await prisma.subject.findFirst({ where: { name: 'Chemistry' } });
  if (chemSub) {
    await prisma.question.updateMany({
      where: { text: { contains: 'mol dm-3' } },
      data: { subjectId: chemSub.id, topic: 'Chemistry Past Questions' },
    });
  }

  // 4. Restore Echo / speed of sound to Physics
  const phySub = await prisma.subject.findFirst({ where: { name: 'Physics' } });
  if (phySub) {
    await prisma.question.updateMany({
      where: { text: { contains: 'speed in sound air' } },
      data: { subjectId: phySub.id, topic: 'Physics Past Questions' },
    });
  }

  // 5. Verify the target question: "Simplify 3 1/3 - 1 1/4 ÷ 2 2/3 + 1 2/5"
  const targetQ = await prisma.question.findFirst({
    where: { text: { contains: 'Simplify 3 1/3' } },
    include: { subject: true },
  });

  console.log('\n✅ VERIFIED TARGET MATH QUESTION IN DB:');
  console.log('ID:', targetQ?.id);
  console.log('Subject:', targetQ?.subject.name);
  console.log('Text:', targetQ?.text);
  console.log('Options:', JSON.stringify(targetQ?.options, null, 2));

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL VERIFIED SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
