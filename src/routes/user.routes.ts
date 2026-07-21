import { Router } from 'express';
import { z } from 'zod';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const updateMeSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional(),
    phone: z.string().optional(),
    school: z.string().optional(),
    class: z.string().optional(),
    state: z.string().optional(),
    photo: z.string().optional(),
  }),
});

router.use(authenticate);

router.get('/me', userController.getMe);
router.put('/me', validate(updateMeSchema), userController.updateMe);

// Admin-only routes
router.get('/', requireRole('ADMIN', 'SUPER_ADMIN'), userController.getUsers);
router.get('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), userController.getUserById);

export default router;
