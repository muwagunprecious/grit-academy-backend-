import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';

const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

const VALID_SUBJECT_NAMES = [
  'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Literature', 'Government', 'CRS', 'Economics', 'Commerce', 'Accounting'
];

interface QuestionToProcess {
  id: string;
  text: string;
  currentSubject: string;
  options: { id: string; text: string }[];
}

async function classifyBatchWithAi(batch: QuestionToProcess[]): Promise<Record<string, string>> {
  const prompt = `You are a master curriculum auditor for Nigerian secondary school exams (JAMB UTME, WAEC, NECO).
Classify each of the following ${batch.length} examination questions into EXACTLY ONE of these valid subjects:
- English
- Mathematics
- Physics
- Chemistry
- Biology
- Literature
- Government
- CRS
- Economics
- Commerce
- Accounting

Input Questions JSON:
${JSON.stringify(
  batch.map(q => ({
    id: q.id,
    text: q.text,
    currentSubject: q.currentSubject,
    options: q.options.map(o => `${o.id}: ${o.text}`).join(' | '),
  })),
  null,
  2
)}

Output Requirement:
Return a JSON object where each key is the question "id" and the value is the single exact valid Subject Name.
Example:
{
  "q_id_1": "Physics",
  "q_id_2": "Chemistry"
}

Return ONLY valid JSON. No explanation text.`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      let completion;
      try {
        completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
      } catch (e: any) {
        if (e?.status === 429 || e?.message?.includes('rate_limit')) {
          console.warn(`⏳ Groq rate limit hit on attempt ${attempt}. Waiting 15 seconds...`);
          await new Promise(r => setTimeout(r, 15000));
        }
        completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.1-8b-instant',
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
      }

      const content = completion.choices[0]?.message?.content;
      if (!content) return {};
      return JSON.parse(content);
    } catch (err: any) {
      if (err?.status === 429 || err?.message?.includes('rate_limit')) {
        console.warn(`⏳ Groq 429 rate limit on attempt ${attempt}. Waiting 18 seconds before retry...`);
        await new Promise(r => setTimeout(r, 18000));
      } else {
        console.error('Batch AI classification error:', err.message);
        if (attempt === 4) return {};
      }
    }
  }
  return {};
}

async function main() {
  console.log('🤖 Starting Groq AI-Powered Full-Database Subject Fine-Tuning Pipeline...');

  const dbSubjects = await prisma.subject.findMany();
  const subjectIdMap = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectIdMap.set(s.name.toLowerCase(), s.id);
  }

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Loaded ${allQuestions.length} total questions from database.`);

  const BATCH_SIZE = 25;
  const CONCURRENCY = 1;
  let reclassifiedCount = 0;

  const totalBatches = Math.ceil(allQuestions.length / BATCH_SIZE);
  console.log(`Processing ${totalBatches} total batches...`);

  for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
    const chunk = allQuestions.slice(i, i + BATCH_SIZE);
    const batchPayload: QuestionToProcess[] = chunk.map(q => ({
      id: q.id,
      text: q.text,
      currentSubject: q.subject?.name || 'Unknown',
      options: (q.options as any[]) || [],
    }));

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`\n🧠 Processing batch ${batchNum}/${totalBatches} (Questions ${i + 1} to ${Math.min(i + BATCH_SIZE, allQuestions.length)})...`);

    const aiResults = await classifyBatchWithAi(batchPayload);
    for (const q of chunk) {
      let suggestedSubject = aiResults[q.id];
      if (!suggestedSubject) continue;
      suggestedSubject = suggestedSubject.trim();
      const normMatch = VALID_SUBJECT_NAMES.find(name => name.toLowerCase() === suggestedSubject.toLowerCase());
      if (!normMatch) continue;

      const targetSubjectId = subjectIdMap.get(normMatch.toLowerCase());
      if (targetSubjectId && targetSubjectId !== q.subjectId) {
        console.log(`    ✨ RECLASSIFIED [${q.subject?.name} ➔ ${normMatch}]: "${q.text.slice(0, 60)}..."`);
        await prisma.question.update({
          where: { id: q.id },
          data: {
            subjectId: targetSubjectId,
            topic: `${normMatch} Exam Questions`,
          },
        });
        reclassifiedCount++;
      }
    }

    // Pace requests nicely
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log('\n=================================================');
  console.log(`🎉 GROQ AI FINE-TUNING COMPLETE!`);
  console.log(`- Reclassified & moved ${reclassifiedCount} questions into their exact subjects.`);
  console.log('=================================================');

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL VERIFIED SUBJECT QUESTION COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
