import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';

const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

const VALID_SUBJECT_NAMES = [
  'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Literature', 'Government', 'CRS', 'Economics', 'Commerce', 'Accounting'
];

// Exact dictionary replacements for known OCR symbol corruption
const REPLACEMENT_RULES: [RegExp, string][] = [
  [/“i\s*ŵplifLJ/gi, 'Simplify'],
  [/ŵplifLJ/gi, 'Simplify'],
  [/ŵpli\w*/gi, 'Simplify'],
  [/ϯ\s*⅓/g, '3 1/3'],
  [/ϭ\s*¼/g, '1 1/4'],
  [/ϭ\s*⅖/g, '1 2/5'],
  [/⅟10/g, '1/10'],
  [/⅟(\d+)/g, '1/$1'],
  [/dž/g, '÷'],
  [/ϯ/g, '3'],
  [/ϭ/g, '1'],
  [/⅓/g, '1/3'],
  [/⅔/g, '2/3'],
  [/¼/g, '1/4'],
  [/¾/g, '3/4'],
  [/½/g, '1/2'],
  [/⅖/g, '2/5'],
  [/⅕/g, '1/5'],
  [/⅗/g, '3/5'],
  [/⅘/g, '4/5'],
  [/⅙/g, '1/6'],
  [/⅚/g, '5/6'],
  [/⅛/g, '1/8'],
  [/⅜/g, '3/8'],
  [/⅝/g, '5/8'],
  [/⅞/g, '7/8'],
];

function preCleanText(text: string): string {
  let cleaned = text;
  for (const [pattern, replacement] of REPLACEMENT_RULES) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

async function aiRepairQuestion(q: any): Promise<{ text: string; options: any[]; subject: string } | null> {
  const prompt = `You are a master exam editor and mathematics proofreader for secondary school exams (WAEC, JAMB UTME).
Fix any broken OCR text, corrupt characters, or garbled math symbols in the following question and options, restoring it to clean mathematical notation and proper English.
Also state which exact Subject it belongs to (Mathematics, Physics, Chemistry, Biology, English, Literature, Government, CRS, Economics, Commerce).

Raw Question Text: "${q.text}"
Raw Options JSON: ${JSON.stringify(q.options)}
Current Subject: "${q.subject?.name || 'Unknown'}"

Output Requirement:
Return ONLY a JSON object in this exact schema:
{
  "text": "Cleaned, proper question text",
  "options": [
    { "id": "A", "text": "Cleaned option text", "isCorrect": boolean },
    ...
  ],
  "subject": "Mathematics"
}

No extra commentary.`;

  try {
    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
    } catch {
      completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err: any) {
    console.error(`AI Repair failed for Q ID ${q.id}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('🔧 Starting OCR Character Repair & Groq AI Question Proofreading Pipeline...\n');

  const dbSubjects = await prisma.subject.findMany();
  const subjectIdMap = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectIdMap.set(s.name.toLowerCase(), s.id);
  }

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  console.log(`Loaded ${allQuestions.length} questions from database.`);

  let ruleCleanedCount = 0;
  let aiRepairedCount = 0;

  for (const q of allQuestions) {
    const rawCombined = q.text + ' ' + JSON.stringify(q.options);
    const hasCorruptChar = /[“i\s*ŵplifLJ|ŵ|ϯ|ϭ|dž|⅟|¿|§|©|™]/i.test(rawCombined);

    if (hasCorruptChar) {
      console.log(`\n🔍 Found Corrupt Question [${q.subject?.name}] ID ${q.id}:`);
      console.log(`   BEFORE: "${q.text}"`);

      // 1. Apply rule-based pre-cleaning
      const preCleanedText = preCleanText(q.text);
      const preCleanedOptions = (q.options as any[]).map(o => ({
        ...o,
        text: preCleanText(o.text),
      }));

      // 2. Call Groq AI for full proofreading
      const aiResult = await aiRepairQuestion({
        id: q.id,
        text: preCleanedText,
        options: preCleanedOptions,
        subject: q.subject,
      });

      const finalText = aiResult?.text || preCleanedText;
      const finalOptions = aiResult?.options || preCleanedOptions;
      const finalSubjectName = aiResult?.subject || q.subject?.name || 'Mathematics';

      const targetSubId = subjectIdMap.get(finalSubjectName.toLowerCase()) || q.subjectId;

      console.log(`   AFTER:  "${finalText}"`);
      console.log(`   SUBJECT: ${q.subject?.name} ➔ ${finalSubjectName}`);

      await prisma.question.update({
        where: { id: q.id },
        data: {
          text: finalText,
          options: finalOptions,
          subjectId: targetSubId,
          topic: `${finalSubjectName} Past Questions`,
        },
      });

      if (aiResult) aiRepairedCount++;
      else ruleCleanedCount++;

      // Pause briefly between AI calls
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log('\n=================================================');
  console.log(`🎉 REPAIR COMPLETE!`);
  console.log(`- Repaired ${aiRepairedCount + ruleCleanedCount} corrupt questions with clean Math & English symbols.`);
  console.log('=================================================');

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL CLEAN SUBJECT QUESTION COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
