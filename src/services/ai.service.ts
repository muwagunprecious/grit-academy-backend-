import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';
import { BadRequestError } from '../utils/errors.js';

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  throw new Error('GROQ_API_KEY environment variable is required');
}
const groq = new Groq({ apiKey: groqApiKey });

export const generateQuestionsFromText = async (
  text: string,
  subjectId: string,
  pdfId?: string,
  numQuestions = 10,
  difficulty = 'MEDIUM'
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

      // Keep text snippet within Groq's 12,000 TPM limit (24,000 chars ~ 6,000 tokens)
      const textSnippet = text.slice(0, 24000);

      const prompt = `You are a strict text parser and past-question extraction engine for Nigerian JAMB (UTME), WAEC, and NECO exams.

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

      // Use llama-3.3-70b-versatile, fallback to llama-3.1-8b-instant if rate limit hit
      const modelToUse = attempt > 1 ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile';

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
        if (groqErr.status === 413 || groqErr.message?.includes('TPM') || groqErr.message?.includes('rate_limit')) {
          console.warn(`Groq rate limit hit on ${modelToUse}. Falling back to llama-3.1-8b-instant (30k TPM)...`);
          chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
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
          const dbQ = await prisma.question.create({
            data: {
              text: q.text,
              type: q.type || 'SINGLE_CHOICE',
              options: q.options,
              explanation: q.explanation || 'No explanation provided.',
              subjectId,
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
    const correctOption = (question.options as any[]).find(o => o.isCorrect);
    const studentOption = (question.options as any[]).find(o => o.id === studentAnswerId);

    const prompt = `You are an expert Nigerian secondary school tutor. A student got a question ${
      studentOption?.isCorrect ? 'CORRECT' : 'WRONG'
    }. Explain the concepts clearly.

Question: ${question.text}
Options:
${(question.options as any[]).map(o => `- Option [${o.id}]: ${o.text}`).join('\n')}
Correct Answer: Option [${correctOption?.id}]: ${correctOption?.text}
Student's Answer: Option [${studentAnswerId}]: ${studentOption?.text || 'Skipped'}

Provide a structured response in valid JSON with these keys:
{
  "simpleExplanation": "A 1-2 sentence extremely simple explanation of the concept...",
  "detailedExplanation": "A complete, student-friendly explanation of why the correct answer is right and why the other options are distractors...",
  "examTip": "A strategic tip or common trap for this type of question in WAEC/JAMB...",
  "memoryTrick": "A mnemonic, rhyme, analogy or acronym to help the student remember this concept easily...",
  "relatedTopic": "Name of the related topic...",
  "suggestedReading": "General study recommendation..."
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('AI returned no explanation');
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('AI Correction Error:', error);
    // Return fallback structured content
    return {
      simpleExplanation: 'Could not generate explanation due to an AI service error.',
      detailedExplanation: question.explanation || 'Refer to textbook definitions.',
      examTip: 'Always read all options carefully before selecting.',
      memoryTrick: 'N/A',
      relatedTopic: question.topic || 'General',
      suggestedReading: 'Review this topic in your recommended syllabus textbooks.',
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
      model: 'llama-3.3-70b-versatile',
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
