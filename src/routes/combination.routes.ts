import { Router } from 'express';
import { z } from 'zod';
import * as combinationController from '../controllers/combination.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const combinationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    icon: z.string().optional(),
    subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    isActive: z.boolean().optional(),
    subjects: z.array(z.string()).optional(),
  }),
});

router.get('/', optionalAuthenticate, combinationController.getCombinations);

// Admin-only operations
router.post('/', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), validate(combinationSchema), combinationController.createCombination);
router.put('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), validate(updateSchema), combinationController.updateCombination);
router.delete('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), combinationController.deleteCombination);

export default router;
