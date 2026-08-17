import prisma from '../lib/prisma.js';

async function fix() {
  console.log('🧼 Starting Deep Chemistry Reclassification & Watermark Artifact Cleanup...');

  const chemSub = await prisma.subject.findFirst({ where: { name: 'Chemistry' } });
  const phySub  = await prisma.subject.findFirst({ where: { name: 'Physics' } });

  if (!chemSub || !phySub) return;

  // 1. Move Chemistry questions currently in Physics to Chemistry
  const chemKeywordsInPhysics = [
    'solubility', 'solute', 'concentration', 'ripening agent', 'ripening of fruits',
    'ethane', 'propene', 'methane', 'butane', 'alkene', 'alkane', 'alkyne',
    'estradiate', 'esterification', 'saponification', 'catalytic hydrogenation',
    'cassiterite', 'vulcanization', 'radioactive isotopes', 'blast furnace',
    'electrovalent', 'covalent', 'paraffin', 'paraffins', 'dinitrophenylhydrazine',
    'lucas reagent', 'trioxocarbonate', 'tetraoxosulphate', 'trioxonitrate',
    'water of crystallization', 'bleaching agent', 'brownian motion'
  ];

  const phyQuestions = await prisma.question.findMany({
    where: { subjectId: phySub.id },
  });

  let movedCount = 0;
  for (const q of phyQuestions) {
    const textLower = (q.text + ' ' + JSON.stringify(q.options)).toLowerCase();
    const isChem = chemKeywordsInPhysics.some(kw => textLower.includes(kw));

    if (isChem) {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          subjectId: chemSub.id,
          topic: 'Chemistry Past Questions',
        },
      });
      movedCount++;
      console.log(`  [Moved to Chemistry] "${q.text.slice(0, 75)}..."`);
    }
  }

  console.log(`\n✅ Moved ${movedCount} Chemistry questions from Physics to Chemistry.`);

  // 2. Clean PDF Watermark Artifacts from all question text & options
  const watermarkRegex = /CLASSIC\s+EDUCATIONAL\s+CONSULTS|www\.myschoolgist\.com(?:\.ng)?|OOUMEDIA\s+4\s+OOU\s+newsupdate|Courtesy:?\s*OOU[\s\S]*?group|By\s*Qadr\s*Yusuf\s*Olawale/gi;

  const allQuestions = await prisma.question.findMany();
  let cleanedArtifactsCount = 0;

  for (const q of allQuestions) {
    let textChanged = false;
    let newText = q.text;

    if (watermarkRegex.test(newText)) {
      newText = newText.replace(watermarkRegex, '').trim().replace(/\s+/g, ' ');
      textChanged = true;
    }

    const rawOptions = (q.options as any[]) || [];
    let optionsChanged = false;

    const newOptions = rawOptions.map(opt => {
      let optText = opt.text;
      if (watermarkRegex.test(optText)) {
        optText = optText.replace(watermarkRegex, '').trim().replace(/\s+/g, ' ');
        optionsChanged = true;
      }
      return { ...opt, text: optText };
    });

    // Fix Q1 correctness: Solubility curve is variation of solute concentration with Temperature (B)
    if (q.text.toLowerCase().includes('solubility curve shows')) {
      newOptions.forEach(o => {
        o.isCorrect = o.id === 'B' || o.text.toLowerCase().includes('temperature');
      });
      optionsChanged = true;
    }

    if (textChanged || optionsChanged) {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          text: newText,
          options: newOptions,
        },
      });
      cleanedArtifactsCount++;
    }
  }

  console.log(`✅ Cleaned watermark artifacts and corrected options on ${cleanedArtifactsCount} questions.`);

  // Final tally
  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
