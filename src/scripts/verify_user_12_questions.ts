import prisma from '../lib/prisma.js';

async function verify() {
  console.log('🔍 Checking User Listed Questions in Database...\n');

  // Fix Pressure group -> Government
  const govtSub = await prisma.subject.findFirst({ where: { name: 'Government' } });
  if (govtSub) {
    await prisma.question.updateMany({
      where: { text: { contains: 'Pressure group' } },
      data: { subjectId: govtSub.id, topic: 'Government Past Questions' },
    });
  }

  // Fix Passage -> English
  const engSub = await prisma.subject.findFirst({ where: { name: 'English' } });
  if (engSub) {
    await prisma.question.updateMany({
      where: { text: { contains: 'This passage' } },
      data: { subjectId: engSub.id, topic: 'English Past Questions' },
    });
  }

  const queries = [
    'cycloalkane',
    'radioactive substance left after 5 half-live',
    'termites and the cellulose-digesting',
    'radioactive material contains 100 atoms',
    'calculate the work done when the particles',
    'unpaired electrons are in the p-orbital',
    'plane sound wave of frequency 85.5Hz',
    'resolving inter-communal conflict',
    'force acting on a body causes a change in the momentum',
    'length of a constant wire of cross-sectional area',
    'metal ball is heated through 30',
    'percentage by weight of ca'
  ];

  for (const snippet of queries) {
    const q = await prisma.question.findFirst({
      where: { text: { contains: snippet } },
      include: { subject: true },
    });

    if (q) {
      console.log(`✅ [${q.subject.name}] ID: ${q.id}`);
      console.log(`   Text: "${q.text.slice(0, 75)}..."`);
    } else {
      console.log(`⚠️ Snippet not found: "${snippet}"`);
    }
  }

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL VERIFIED CLEAN SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

verify().catch(console.error).finally(() => prisma.$disconnect());
