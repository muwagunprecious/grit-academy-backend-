import { Router } from 'express';
import { z } from 'zod';
import * as testController from '../controllers/test.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const testSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    combinationId: z.string().min(1, 'Combination ID is required'),
    price: z.number().min(0, 'Price must be non-negative'),
    duration: z.number().min(1, 'Duration must be at least 1 minute'),
    passingScore: z.number().min(0).max(100).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
    instructions: z.string().optional(),
    negativeMarking: z.boolean().optional(),
    negativeScore: z.number().optional(),
    maxAttempts: z.number().nullable().optional(),
    coverImage: z.string().optional(),
  }),
});

router.get('/', optionalAuthenticate, testController.getTests);
router.get('/:id', optionalAuthenticate, testController.getTestById);

// Admin-only test management routes
router.post('/', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), validate(testSchema), testController.createTest);
router.put('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), validate(testSchema.partial()), testController.updateTest);
router.delete('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), testController.deleteTest);
router.post('/:id/questions', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), testController.setTestQuestions);
router.patch('/:id/publish', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), testController.publishTest);

export default router;
