import { Router } from 'express';
import { z } from 'zod';
import * as attemptController from '../controllers/attempt.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const startSchema = z.object({
  body: z.object({
    testId: z.string().min(1, 'Test ID is required'),
  }),
});

const saveSchema = z.object({
  body: z.object({
    answers: z.array(
      z.object({
        questionId: z.string(),
        selectedOptionId: z.string().nullable(),
        timeTaken: z.number().optional(),
      })
    ),
    timeUsed: z.number().optional(),
  }),
});

router.use(authenticate);

router.post('/start', validate(startSchema), attemptController.startAttempt);
router.post('/custom', attemptController.startCustomAttempt);
router.put('/:id/save', validate(saveSchema), attemptController.saveAttempt);
router.post('/:id/submit', validate(saveSchema), attemptController.submitAttempt);
router.get('/:id', attemptController.getAttemptById);
router.get('/user', attemptController.getAllUserAttempts);
router.get('/user/:testId', attemptController.getAttemptsForTest);

export default router;
