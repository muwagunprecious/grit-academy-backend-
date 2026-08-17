import prisma from '../lib/prisma.js';

async function check() {
  console.log('--- CHECKING PHYSICS QUESTIONS ---');
  const phy = await prisma.question.findMany({
    where: { subject: { name: 'Physics' } },
  });

  const phyNonPhysics: any[] = [];
  for (const q of phy) {
    const text = q.text.toLowerCase();
    // Flags for obvious non-physics content (biology, english, govt, etc.)
    if (text.includes('passage') || text.includes('author') || text.includes('cell') || text.includes('dna') || text.includes('photosynthesis') || text.includes('acid') || text.includes('base') || text.includes('constitution') || text.includes('election') || text.includes('jesus')) {
      phyNonPhysics.push(q);
    }
  }
  console.log(`Found ${phyNonPhysics.length} suspicious questions in Physics out of ${phy.length}`);
  phyNonPhysics.forEach(q => console.log(` [Physics Warning] ID: ${q.id} | Text: "${q.text.slice(0, 80)}"`));

  console.log('\n--- CHECKING BIOLOGY QUESTIONS ---');
  const bio = await prisma.question.findMany({
    where: { subject: { name: 'Biology' } },
  });

  const bioNonBio: any[] = [];
  for (const q of bio) {
    const text = q.text.toLowerCase();
    // Flags for obvious non-biology content (physics, chemistry, math equations, govt)
    if (text.includes('velocity') || text.includes('acceleration') || text.includes('force') || text.includes('voltage') || text.includes('resistance') || text.includes('dx/dy') || text.includes('constitution') || text.includes('president')) {
      bioNonBio.push(q);
    }
  }
  console.log(`Found ${bioNonBio.length} suspicious questions in Biology out of ${bio.length}`);
  bioNonBio.forEach(q => console.log(` [Biology Warning] ID: ${q.id} | Text: "${q.text.slice(0, 80)}"`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
