import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';

const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

const VALID_SUBJECT_NAMES = [
  'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Literature', 'Government', 'CRS', 'Economics', 'Commerce', 'Accounting'
];

// Specific dictionary for OCR font corruption artifacts
const OCR_CORRUPTIONS: [RegExp, string][] = [
  [/laďouƌeƌ͛s/gi, "labourer's"],
  [/laďouƌeƌ/gi, "labourer"],
  [/dailLJ/g, "daily"],
  [/ǁage/g, "wage"],
  [/ǁ/g, "w"],
  [/=N=/g, "N"],
  [/=N/g, "N"],
  [/N=/g, "N"],
  [/“i\s*ŵplifLJ/gi, "Simplify"],
  [/ŵplifLJ/gi, "Simplify"],
  [/ŵpli\w*/gi, "Simplify"],
  [/ϯ\s*⅓/g, "3 1/3"],
  [/ϭ\s*¼/g, "1 1/4"],
  [/ϭ\s*⅖/g, "1 2/5"],
  [/⅟10/g, "1/10"],
  [/⅟(\d+)/g, "1/$1"],
  [/dž/g, "÷"],
  [/ϯ/g, "3"],
  [/ϭ/g, "1"],
  [/⅓/g, "1/3"],
  [/⅔/g, "2/3"],
  [/¼/g, "1/4"],
  [/¾/g, "3/4"],
  [/½/g, "1/2"],
  [/⅖/g, "2/5"],
  [/⅕/g, "1/5"],
  [/⅗/g, "3/5"],
  [/⅘/g, "4/5"],
];

function sanitizeOcrText(text: string): string {
  let cleaned = text;
  for (const [pattern, replacement] of OCR_CORRUPTIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.trim().replace(/\s+/g, ' ');
}

async function proofreadAndClassifyWithAi(q: any): Promise<{ text: string; options: any[]; subject: string } | null> {
  const prompt = `You are a master secondary school exam editor (WAEC, JAMB UTME).
Review this question:
1. Fix any broken OCR text, weird characters (like "laďouƌeƌ͛s", "dailLJ", "ǁage", "=N="), or corrupt symbols, converting them into clean English and standard math notation.
2. Determine its EXACT subject domain from: English, Mathematics, Physics, Chemistry, Biology, Literature, Government, CRS, Economics, Commerce.

Question Text: "${q.text}"
Options JSON: ${JSON.stringify(q.options)}
Current Subject: "${q.subject?.name}"

Output JSON format ONLY:
{
  "text": "Cleaned question text",
  "options": [
    { "id": "A", "text": "Cleaned option text", "isCorrect": boolean },
    ...
  ],
  "subject": "Mathematics"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (e: any) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

async function runFullDatabaseAudit() {
  console.log('🧼 Starting Exhaustive Groq AI Proofreading & Subject Classification Pipeline...\n');

  const dbSubjects = await prisma.subject.findMany();
  const subjectIdMap = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectIdMap.set(s.name.toLowerCase(), s.id);
  }

  const mathSubject = dbSubjects.find(s => s.name === 'Mathematics');
  if (!mathSubject) return;

  // Fetch all current Mathematics questions
  const mathQuestions = await prisma.question.findMany({
    where: { subjectId: mathSubject.id },
    include: { subject: true },
  });

  console.log(`Found ${mathQuestions.length} questions currently under Mathematics.`);

  let repairedCount = 0;
  let reclassifiedCount = 0;

  const BATCH_SIZE = 5;
  for (let i = 0; i < mathQuestions.length; i += BATCH_SIZE) {
    const chunk = mathQuestions.slice(i, i + BATCH_SIZE);
    console.log(`  🚀 Processing Math Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(mathQuestions.length / BATCH_SIZE)}...`);

    const promises = chunk.map(async (q) => {
      const preCleanedText = sanitizeOcrText(q.text);
      const preCleanedOptions = (q.options as any[]).map(o => ({
        ...o,
        text: sanitizeOcrText(o.text),
      }));

      const aiRes = await proofreadAndClassifyWithAi({
        text: preCleanedText,
        options: preCleanedOptions,
        subject: q.subject,
      });

      const finalText = aiRes?.text || preCleanedText;
      const finalOptions = aiRes?.options || preCleanedOptions;
      const targetSubjectName = aiRes?.subject || 'Mathematics';

      const targetSubId = subjectIdMap.get(targetSubjectName.toLowerCase()) || mathSubject.id;

      if (targetSubjectName !== 'Mathematics') {
        console.log(`    📌 RECLASSIFIED OUT OF MATHS [Mathematics ➔ ${targetSubjectName}]: "${finalText.slice(0, 60)}..."`);
      }

      if (finalText !== q.text || JSON.stringify(finalOptions) !== JSON.stringify(q.options) || targetSubId !== q.subjectId) {
        await prisma.question.update({
          where: { id: q.id },
          data: {
            text: finalText,
            options: finalOptions,
            subjectId: targetSubId,
            topic: `${targetSubjectName} Past Questions`,
          },
        });
        return { repaired: true, reclassified: targetSubjectName !== 'Mathematics' };
      }
      return { repaired: false, reclassified: false };
    });

    const results = await Promise.all(promises);
    repairedCount += results.filter(r => r.repaired).length;
    reclassifiedCount += results.filter(r => r.reclassified).length;

    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n=================================================');
  console.log(`🎉 AUDIT & PROOFREADING COMPLETE!`);
  console.log(`- Repaired OCR text & options on ${repairedCount} Mathematics questions.`);
  console.log(`- Moved ${reclassifiedCount} non-math questions out of Mathematics.`);
  console.log('=================================================');

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL VERIFIED CLEAN SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

runFullDatabaseAudit().catch(console.error).finally(() => prisma.$disconnect());
