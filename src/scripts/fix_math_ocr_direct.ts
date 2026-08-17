import prisma from '../lib/prisma.js';

async function fixMathSymbols() {
  console.log('🧹 Executing Direct Math OCR Character Cleanup Across All Questions...\n');

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  let fixedCount = 0;

  for (const q of allQuestions) {
    let oldText = q.text;
    let newText = oldText;

    // Fix garbled words & math operators
    newText = newText.replace(/“i\s*ŵplifLJ/gi, 'Simplify');
    newText = newText.replace(/ŵplifLJ/gi, 'Simplify');
    newText = newText.replace(/ŵpli\w*/gi, 'Simplify');
    newText = newText.replace(/ϯ\s*⅓/g, '3 1/3');
    newText = newText.replace(/ϭ\s*¼/g, '1 1/4');
    newText = newText.replace(/ϭ\s*⅖/g, '1 2/5');
    newText = newText.replace(/⅟10/g, '1/10');
    newText = newText.replace(/⅟(\d+)/g, '1/$1');
    newText = newText.replace(/dž/g, '÷');
    newText = newText.replace(/ϯ/g, '3');
    newText = newText.replace(/ϭ/g, '1');
    newText = newText.replace(/⅓/g, '1/3');
    newText = newText.replace(/⅔/g, '2/3');
    newText = newText.replace(/¼/g, '1/4');
    newText = newText.replace(/¾/g, '3/4');
    newText = newText.replace(/½/g, '1/2');
    newText = newText.replace(/⅖/g, '2/5');
    newText = newText.replace(/⅕/g, '1/5');
    newText = newText.replace(/⅗/g, '3/5');
    newText = newText.replace(/⅘/g, '4/5');
    newText = newText.replace(/⅙/g, '1/6');
    newText = newText.replace(/⅚/g, '5/6');
    newText = newText.replace(/⅛/g, '1/8');
    newText = newText.replace(/⅜/g, '3/8');
    newText = newText.replace(/⅝/g, '5/8');
    newText = newText.replace(/⅞/g, '7/8');

    // Fix options
    const rawOpts = (q.options as any[]) || [];
    let optsChanged = false;

    const newOpts = rawOpts.map(opt => {
      let optText = opt.text;
      const oldOptText = optText;

      optText = optText.replace(/“i\s*ŵplifLJ/gi, 'Simplify');
      optText = optText.replace(/ŵplifLJ/gi, 'Simplify');
      optText = optText.replace(/ŵpli\w*/gi, 'Simplify');
      optText = optText.replace(/ϯ\s*⅓/g, '3 1/3');
      optText = optText.replace(/ϭ\s*¼/g, '1 1/4');
      optText = optText.replace(/ϭ\s*⅖/g, '1 2/5');
      optText = optText.replace(/⅟10/g, '1/10');
      optText = optText.replace(/⅟(\d+)/g, '1/$1');
      optText = optText.replace(/dž/g, '÷');
      optText = optText.replace(/ϯ/g, '3');
      optText = optText.replace(/ϭ/g, '1');
      optText = optText.replace(/⅓/g, '1/3');
      optText = optText.replace(/⅔/g, '2/3');
      optText = optText.replace(/¼/g, '1/4');
      optText = optText.replace(/¾/g, '3/4');
      optText = optText.replace(/½/g, '1/2');
      optText = optText.replace(/⅖/g, '2/5');
      optText = optText.replace(/⅕/g, '1/5');
      optText = optText.replace(/⅗/g, '3/5');
      optText = optText.replace(/⅘/g, '4/5');
      optText = optText.replace(/⅙/g, '1/6');
      optText = optText.replace(/⅚/g, '5/6');
      optText = optText.replace(/⅛/g, '1/8');
      optText = optText.replace(/⅜/g, '3/8');
      optText = optText.replace(/⅝/g, '5/8');
      optText = optText.replace(/⅞/g, '7/8');

      if (optText !== oldOptText) optsChanged = true;
      return { ...opt, text: optText };
    });

    // Check subject reassignment: if question starts with "Simplify" or has fractions/equations, ensure subject is Mathematics!
    let targetSubId = q.subjectId;
    let targetTopic = q.topic;

    if (newText.startsWith('Simplify') || /\b(\d+\/\d+|\+|\-|\÷|\×|\=)\b/.test(newText)) {
      const mathSub = await prisma.subject.findFirst({ where: { name: 'Mathematics' } });
      if (mathSub && mathSub.id !== q.subjectId) {
        targetSubId = mathSub.id;
        targetTopic = 'Mathematics Past Questions';
        console.log(`  📌 MOVED TO MATHEMATICS: "${newText.slice(0, 60)}..."`);
      }
    }

    if (newText !== oldText || optsChanged || targetSubId !== q.subjectId) {
      console.log(`  ✨ FIXED [${q.subject?.name}]:`);
      console.log(`     OLD: "${oldText}"`);
      console.log(`     NEW: "${newText}"`);

      await prisma.question.update({
        where: { id: q.id },
        data: {
          text: newText,
          options: newOpts,
          subjectId: targetSubId,
          topic: targetTopic,
        },
      });

      fixedCount++;
    }
  }

  console.log(`\n🎉 Successfully cleaned and repaired ${fixedCount} question entries.`);

  // Print final subject counts
  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- VERIFIED CLEAN SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

fixMathSymbols().catch(console.error).finally(() => prisma.$disconnect());
