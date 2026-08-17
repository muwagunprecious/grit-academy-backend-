import prisma from '../lib/prisma.js';

function cleanCorruptString(str: string): string {
  if (!str) return '';
  // 1. Normalize unicode and remove combining marks (accents/diacritics)
  let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Exact word repairs
  s = s.replace(/la[dď]ou[rƌ][eē][rƌ]?'?s?/gi, "labourer's");
  s = s.replace(/dailLJ/gi, 'daily');
  s = s.replace(/ǁage/gi, 'wage');
  s = s.replace(/ǁ/gi, 'w');
  s = s.replace(/=N=/gi, 'N');
  s = s.replace(/=N/gi, 'N');
  s = s.replace(/N=/gi, 'N');

  s = s.replace(/“i\s*ŵplifLJ/gi, 'Simplify');
  s = s.replace(/ŵplifLJ/gi, 'Simplify');
  s = s.replace(/ŵpli\w*/gi, 'Simplify');
  s = s.replace(/dž/gi, '÷');

  s = s.replace(/ϯ\s*⅓/g, '3 1/3');
  s = s.replace(/ϭ\s*¼/g, '1 1/4');
  s = s.replace(/ϭ\s*⅖/g, '1 2/5');
  s = s.replace(/⅟10/g, '1/10');
  s = s.replace(/⅟(\d+)/g, '1/$1');
  s = s.replace(/ϯ/g, '3');
  s = s.replace(/ϭ/g, '1');
  s = s.replace(/⅓/g, '1/3');
  s = s.replace(/⅔/g, '2/3');
  s = s.replace(/¼/g, '1/4');
  s = s.replace(/¾/g, '3/4');
  s = s.replace(/½/g, '1/2');
  s = s.replace(/⅖/g, '2/5');
  s = s.replace(/⅕/g, '1/5');
  s = s.replace(/⅗/g, '3/5');
  s = s.replace(/⅘/g, '4/5');

  return s.trim().replace(/\s+/g, ' ');
}

async function fixAllUnicodeCorruptions() {
  console.log('🧼 Executing Deep Unicode Normalization & OCR Repair Across All Questions...\n');

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  let fixedCount = 0;

  for (const q of allQuestions) {
    const oldText = q.text;
    const newText = cleanCorruptString(oldText);

    const rawOptions = (q.options as any[]) || [];
    let optionsChanged = false;

    const newOptions = rawOptions.map(opt => {
      const oldOptText = opt.text;
      const newOptText = cleanCorruptString(oldOptText);
      if (newOptText !== oldOptText) optionsChanged = true;
      return { ...opt, text: newOptText };
    });

    if (newText !== oldText || optionsChanged) {
      console.log(`✨ REPAIRED Q ID ${q.id} [${q.subject?.name}]:`);
      console.log(`   BEFORE: "${oldText}"`);
      console.log(`   AFTER:  "${newText}"`);

      await prisma.question.update({
        where: { id: q.id },
        data: {
          text: newText,
          options: newOptions,
        },
      });
      fixedCount++;
    }
  }

  console.log(`\n🎉 Deep Unicode Repair Finished! Cleaned ${fixedCount} questions.`);

  // Verify the target wage question specifically
  const wageQ = await prisma.question.findUnique({
    where: { id: 'cmswrqjwc010xc1s8cuijzcwv' },
    include: { subject: true },
  });

  console.log('\n✅ VERIFIED WAGE QUESTION IN DB:');
  console.log('ID:', wageQ?.id);
  console.log('Subject:', wageQ?.subject.name);
  console.log('Text:', wageQ?.text);
  console.log('Options:', JSON.stringify(wageQ?.options, null, 2));
}

fixAllUnicodeCorruptions().catch(console.error).finally(() => prisma.$disconnect());
