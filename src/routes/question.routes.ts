import { Router } from 'express';
import { z } from 'zod';
import * as questionController from '../controllers/question.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const questionSchema = z.object({
  body: z.object({
    text: z.string().min(1, 'Question text is required'),
    type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK']),
    options: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean(),
      })
    ).min(2, 'At least two options are required'),
    explanation: z.string().optional(),
    subjectId: z.string().min(1, 'Subject ID is required'),
    topic: z.string().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
    marks: z.number().optional(),
    estimatedTime: z.number().optional(),
    bloomTaxonomy: z.string().optional(),
    tags: z.array(z.string()).optional(),
    imageUrl: z.string().optional(),
  }),
});

router.use(authenticate);

// Student & Admin bookmarks
router.get('/bookmarks', questionController.getBookmarks);
router.post('/:id/bookmark', questionController.toggleBookmark);

// Admin-only question bank routes
router.get('/', requireRole('ADMIN', 'SUPER_ADMIN'), questionController.getQuestions);
router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), validate(questionSchema), questionController.createQuestion);
router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), validate(questionSchema.partial()), questionController.updateQuestion);
router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), questionController.deleteQuestion);
router.patch('/:id/approve', requireRole('ADMIN', 'SUPER_ADMIN'), questionController.approveQuestion);
router.patch('/:id/reject', requireRole('ADMIN', 'SUPER_ADMIN'), questionController.rejectQuestion);

export default router;
