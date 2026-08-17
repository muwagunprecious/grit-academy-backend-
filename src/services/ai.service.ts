import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';
import { BadRequestError } from '../utils/errors.js';

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  throw new Error('GROQ_API_KEY environment variable is required');
}
// @ts-ignore - groq-sdk ESM/CJS compat (TS 5.9 strict)
const groq = new Groq({ apiKey: groqApiKey });

export const generateQuestionsFromText = async (
  text: string,
  subjectId: string,
  pdfId?: string,
  numQuestions = 10,
  difficulty = 'MEDIUM',
  isMultiSubject = false,
  extractSubjectIds: string[] = []
) => {
  let lastError: any;

  // Retry up to 3 times on failure
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { combination: true },
      });

      if (!subject) {
        throw new BadRequestError('Subject not found');
      }

      // Fetch subjects for multi-subject classification mapping
      let subjects: any[] = [];
      if (isMultiSubject) {
        if (extractSubjectIds && extractSubjectIds.length > 0) {
          subjects = await prisma.subject.findMany({
            where: { id: { in: extractSubjectIds } },
          });
        } else {
          subjects = await prisma.subject.findMany();
        }
      }
      const subjectNamesList = subjects.map(s => s.name);

      // Keep text snippet within Groq's 12,000 TPM limit (24,000 chars ~ 6,000 tokens)
      const textSnippet = text.slice(0, 24000);

      const prompt = isMultiSubject
        ? `You are a strict text parser and past-question extraction engine for Nigerian JAMB (UTME), WAEC, and NECO exams.

CRITICAL MANDATE:
- You MUST extract EXACTLY ${numQuestions} distinct questions directly from the PDF text below.
- Do NOT stop early or return fewer than ${numQuestions} questions.
- You MUST ONLY extract actual questions that are directly present inside the provided PDF text.
- Do NOT invent, generate, make up, or fabricate your own new questions.

For each question, you MUST determine which subject it belongs to. The subject name MUST match one of the available subjects listed below. If a question does not match any of the listed subjects, map it to the closest fit or the most general subject from the list.

AVAILABLE SUBJECTS:
${subjectNamesList.map(name => `- ${name}`).join('\n')}

PDF PAST QUESTION TEXT:
"""
${textSnippet}
"""

EXTRACTION RULES:
1. Locate and extract EXACTLY ${numQuestions} distinct questions found inside the PDF text above.
2. For each extracted question:
   - Identify the correct subject name from the AVAILABLE SUBJECTS list and assign it to the "subjectName" field.
   - Extract the 4 options (A, B, C, D) if present in the text.
   - IF the question in the text does not have options listed, construct 4 realistic options (A, B, C, D) based on the question content.
   - Mark exactly one correct option with "isCorrect": true.
3. Include a concise step-by-step correction/explanation for the question in the "explanation" field.
4. Return a JSON object with a "questions" key containing the array of EXACTLY ${numQuestions} items.

JSON Structure:
{
  "text": "The exact question text extracted from the PDF...",
  "subjectName": "The EXACT subject name from the AVAILABLE SUBJECTS list...",
  "type": "SINGLE_CHOICE",
  "options": [
    {"id": "A", "text": "Option A text", "isCorrect": true},
    {"id": "B", "text": "Option B text", "isCorrect": false},
    {"id": "C", "text": "Option C text", "isCorrect": false},
    {"id": "D", "text": "Option D text", "isCorrect": false}
  ],
  "explanation": "Step-by-step correction or solution...",
  "topic": "Topic name",
  "difficulty": "${difficulty}",
  "bloomTaxonomy": "Understanding",
  "tags": ["Past Question"],
  "marks": 1,
  "estimatedTime": 45
}

Return ONLY valid JSON. Do not include introductory or concluding text.`
        : `You are a strict text parser and past-question extraction engine for Nigerian JAMB (UTME), WAEC, and NECO exams.

CRITICAL MANDATE:
- You MUST extract EXACTLY ${numQuestions} distinct questions directly from the PDF text below.
- Do NOT stop early or return fewer than ${numQuestions} questions.
- You MUST ONLY extract actual questions that are directly present inside the provided PDF text.
- Do NOT invent, generate, make up, or fabricate your own new questions.

Subject: ${subject.name}
Subject Combination: ${subject.combination?.name || 'General'}

PDF PAST QUESTION TEXT:
"""
${textSnippet}
"""

EXTRACTION RULES:
1. Locate and extract EXACTLY ${numQuestions} distinct questions found inside the PDF text above.
2. For each extracted question:
   - Extract the 4 options (A, B, C, D) if present in the text.
   - IF the question in the text does not have options listed, construct 4 realistic options (A, B, C, D) based on the question content.
   - Mark exactly one correct option with "isCorrect": true.
3. Include a concise step-by-step correction/explanation for the question in the "explanation" field.
4. Return a JSON object with a "questions" key containing the array of EXACTLY ${numQuestions} items.

JSON Structure:
{
  "text": "The exact question text extracted from the PDF...",
  "type": "SINGLE_CHOICE",
  "options": [
    {"id": "A", "text": "Option A text", "isCorrect": true},
    {"id": "B", "text": "Option B text", "isCorrect": false},
    {"id": "C", "text": "Option C text", "isCorrect": false},
    {"id": "D", "text": "Option D text", "isCorrect": false}
  ],
  "explanation": "Step-by-step correction or solution...",
  "topic": "Topic name",
  "difficulty": "${difficulty}",
  "bloomTaxonomy": "Understanding",
  "tags": ["Past Question"],
  "marks": 1,
  "estimatedTime": 45
}

Return ONLY valid JSON. Do not include introductory or concluding text.`;

      const modelToUse = attempt > 1 ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b';

      let chatCompletion;
      try {
        chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: modelToUse,
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });
      } catch (groqErr: any) {
        if (groqErr.status === 413 || groqErr.message?.includes('TPM') || groqErr.message?.includes('rate_limit') || groqErr.message?.includes('model_not_found')) {
          console.warn(`Groq rate limit or error on ${modelToUse}. Falling back to openai/gpt-oss-20b...`);
          chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'openai/gpt-oss-20b',
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
          });
        } else {
          throw groqErr;
        }
      }

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from AI');
      }

      console.log(`AI response received (attempt ${attempt}): ${content.length} chars`);

      // Parse the output with robust handling
      let questionsData: any;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          questionsData = parsed;
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          questionsData = parsed.questions;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          questionsData = parsed.data;
        } else {
          // Try to find any array in the parsed object
          const values = Object.values(parsed);
          for (const val of values) {
            if (Array.isArray(val) && val.length > 0 && val[0]?.text) {
              questionsData = val;
              break;
            }
          }
          if (!questionsData) {
            throw new Error('JSON structure did not contain an array of questions');
          }
        }
      } catch (parseError: any) {
        console.error('Failed to parse AI response:', parseError.message);
        console.error('Raw content:', content.substring(0, 500));
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Validate and clean questions
      const validQuestions = questionsData.filter((q: any) => {
        if (!q.text || !q.options || !Array.isArray(q.options)) return false;
        if (q.options.length < 2) return false;
        // Ensure exactly one option has isCorrect: true
        const correctCount = q.options.filter((o: any) => o.isCorrect === true).length;
        if (correctCount !== 1) return false;
        return true;
      });

      if (validQuestions.length === 0) {
        throw new Error('AI returned no valid questions from the provided text');
      }

      console.log(`Parsed ${validQuestions.length} valid questions from AI response`);

      // Save questions in database as PENDING
      const createdQuestions = [];
      for (const q of validQuestions) {
        try {
          // Resolve subjectId from subjectName if multi-subject mode is active
          let resolvedSubjectId = subjectId;
          if (isMultiSubject && q.subjectName) {
            const matchedSubject = subjects.find(
              (s) => s.name.toLowerCase().trim() === q.subjectName.toLowerCase().trim()
            );
            if (matchedSubject) {
              resolvedSubjectId = matchedSubject.id;
            }
          }

          const dbQ = await prisma.question.create({
            data: {
              text: q.text,
              type: q.type || 'SINGLE_CHOICE',
              options: q.options,
              explanation: q.explanation || 'No explanation provided.',
              subjectId: resolvedSubjectId,
              topic: q.topic || 'General',
              difficulty: (q.difficulty || difficulty) as any,
              marks: q.marks || 1,
              estimatedTime: q.estimatedTime || 40,
              bloomTaxonomy: q.bloomTaxonomy || 'Understanding',
              tags: q.tags || [],
              sourcePdfId: pdfId,
              aiConfidence: 0.9,
              status: 'PENDING',
              isApproved: false,
            },
          });
          createdQuestions.push(dbQ);
        } catch (dbErr: any) {
          console.error('Failed to save question to DB:', dbErr.message);
        }
      }

      if (createdQuestions.length === 0) {
        throw new Error('Failed to save any questions to the database');
      }

      return createdQuestions;
    } catch (error: any) {
      lastError = error;
      console.error(`AI Generation attempt ${attempt} failed:`, error.message);

      // Don't retry on certain errors
      if (error.message.includes('Subject not found') || error.message.includes('does not contain enough')) {
        throw error;
      }

      if (attempt < 3) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  console.error('All AI generation attempts failed:', lastError?.message);
  throw lastError || new Error('AI generation failed after 3 attempts');
};

export const getAiExplanation = async (question: any, studentAnswerId: string) => {
  try {
    const rawOptions = (question.options as any[]) || [];
    const correctOption = rawOptions.find(o => o.isCorrect === true || o.isCorrect === 'true') || rawOptions[0];
    const studentOption = rawOptions.find(o => o.id === studentAnswerId || o.text === studentAnswerId);

    const isCorrect = studentOption ? studentOption.isCorrect === true : false;

    const prompt = `You are a master secondary school teacher for Nigerian WAEC, JAMB (UTME), and NECO past exams.
Provide an exhaustive, step-by-step, pedagogical correction for the following question.

QUESTION: "${question.text}"

OPTIONS:
${rawOptions.map((o, idx) => `- Option [${o.id || String.fromCharCode(65 + idx)}]: "${o.text}" ${o.isCorrect ? '(CORRECT ANSWER)' : ''}`).join('\n')}

STUDENT'S SELECTION: "${studentOption?.text || studentAnswerId || 'Skipped'}" (${isCorrect ? 'CORRECT' : 'WRONG'})

REQUIREMENTS:
1. "simpleExplanation": 1-2 clear sentences summarizing the core rule, definition, or formula.
2. "detailedExplanation": A thorough, step-by-step breakdown explaining WHY Option [${correctOption?.id || 'A'}] ("${correctOption?.text || ''}") is mathematically/grammatically/conceptually correct, AND why each incorrect distractor option is wrong.
3. "examTip": A practical JAMB/WAEC exam strategy or trap to avoid for this specific topic.
4. "memoryTrick": A memorable mnemonic, formula rule, or rhyme to help remember this concept.

Return ONLY a valid JSON object matching this exact structure:
{
  "simpleExplanation": "...",
  "detailedExplanation": "...",
  "examTip": "...",
  "memoryTrick": "...",
  "relatedTopic": "${question.topic || 'General'}",
  "suggestedReading": "Recommended textbook chapter"
}`;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-120b',
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
    } catch (groqErr: any) {
      console.warn('Groq 120b limit or error in explanation, using openai/gpt-oss-20b...');
      completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-20b',
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
    }

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('AI returned no explanation');
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('AI Correction Error:', error);
    const rawOptions = (question.options as any[]) || [];
    const correctOption = rawOptions.find(o => o.isCorrect === true) || rawOptions[0];
    const studentOption = rawOptions.find(o => o.id === studentAnswerId);

    const distractorsText = rawOptions
      .filter(o => !o.isCorrect)
      .map(o => `• Option [${o.id}]: "${o.text}" is incorrect because it does not satisfy the governing principle.`)
      .join('\n');

    return {
      simpleExplanation: `Option [${correctOption?.id || 'A'}] ("${correctOption?.text}") is the correct answer to this question.`,
      detailedExplanation: `Step 1: Analyze the question requirement:\n"${question.text}"\n\nStep 2: Correct Answer Breakdown:\nOption [${correctOption?.id || 'A'}] ("${correctOption?.text}") directly fulfills the required concept in ${question.topic || 'this subject'}.\n\nStep 3: Distractor Analysis:\n${distractorsText}`,
      examTip: 'Eliminate options that conflict with fundamental definitions before making your final selection in WAEC/JAMB.',
      memoryTrick: `Remember: Always associate "${correctOption?.text || 'this rule'}" with ${question.topic || 'the core syllabus topic'}.`,
      relatedTopic: question.topic || 'General',
      suggestedReading: 'Review this topic in your recommended JAMB/WAEC syllabus textbook.',
    };
  }
};

export const generatePersonalizedStudyPlan = async (userId: string) => {
  try {
    // Fetch last 5 test attempts
    const attempts = await prisma.testAttempt.findMany({
      where: { userId, status: 'COMPLETED' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { test: true },
    });

    if (attempts.length === 0) {
      return {
        recommendation: 'Complete a few practice tests to generate a personalized study plan.',
        weakTopics: [],
        strongTopics: [],
        studyPlan: 'A detailed plan will appear here once you take practice exams.',
      };
    }

    // Extract stats
    const averageScore = attempts.reduce((acc: number, curr: any) => acc + curr.percentage, 0) / attempts.length;
    
    // Query weak vs strong subjects based on attempts details
    // For simplicity, aggregate average subject scores from attempt JSONs
    // answers is array of: {questionId, selectedOption, isCorrect, subjectId, topic}
    const topicScores: Record<string, { correct: number; total: number }> = {};

    for (const attempt of attempts) {
      const answers = attempt.answers as any[];
      if (!Array.isArray(answers)) continue;

      for (const ans of answers) {
        // Fetch question topic if not inside answer JSON
        const topic = ans.topic || 'General Concepts';
        if (!topicScores[topic]) {
          topicScores[topic] = { correct: 0, total: 0 };
        }
        topicScores[topic].total += 1;
        if (ans.isCorrect) {
          topicScores[topic].correct += 1;
        }
      }
    }

    const topicsAnalysis = Object.entries(topicScores).map(([topic, stats]) => ({
      topic,
      percentage: (stats.correct / stats.total) * 100,
      total: stats.total,
    }));

    const weakTopics = topicsAnalysis.filter(t => t.percentage < 60).map(t => t.topic);
    const strongTopics = topicsAnalysis.filter(t => t.percentage >= 75).map(t => t.topic);

    const prompt = `Based on a student's practice exam history:
- Average Practice Exam Score: ${averageScore.toFixed(1)}%
- Strong Topics: ${strongTopics.join(', ') || 'None identified yet'}
- Weak Topics: ${weakTopics.join(', ') || 'None identified yet'}

Generate a professional, structured weekly AI study recommendation (Markdown format) that guides the student to improve. Focus on Nigerian curriculum objectives (JAMB/WAEC). Provide target focus areas, study methods, and a positive encouraging summary. Return a valid JSON response with keys:
{
  "recommendation": "Brief general summary of progress...",
  "studyPlan": "Full markdown study plan..."
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-120b',
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('AI returned no plan');
    }

    const parsed = JSON.parse(responseText);
    return {
      recommendation: parsed.recommendation,
      weakTopics,
      strongTopics,
      studyPlan: parsed.studyPlan,
    };
  } catch (error) {
    console.error('AI Study Plan Error:', error);
    return {
      recommendation: 'Focus on reviewing answers from previous attempts.',
      weakTopics: [],
      strongTopics: [],
      studyPlan: 'Create a weekly study routine targeting subjects where you scored under 50%.',
    };
  }
};
