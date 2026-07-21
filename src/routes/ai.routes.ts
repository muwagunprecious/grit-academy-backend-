import { Router } from 'express';
import { z } from 'zod';
import * as aiController from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const explainSchema = z.object({
  body: z.object({
    questionId: z.string().min(1, 'Question ID is required'),
    studentAnswerId: z.string().min(1, 'Student Answer ID is required'),
  }),
});

const generateSchema = z.object({
  body: z.object({
    text: z.string().min(50, 'Provide a longer text snippet for question generation (minimum 50 chars)'),
    subjectId: z.string().min(1, 'Subject ID is required'),
    pdfId: z.string().optional(),
    numQuestions: z.number().min(1).max(20).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']).optional(),
  }),
});

router.use(authenticate);

router.post('/explain', validate(explainSchema), aiController.explainQuestion);
router.get('/study-plan', aiController.getStudyPlan);

// Admin-only question generation
router.post('/generate-questions', requireRole('ADMIN', 'SUPER_ADMIN'), validate(generateSchema), aiController.generateQuestions);

export default router;
