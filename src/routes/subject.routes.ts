import { Router } from 'express';
import * as subjectController from '../controllers/subject.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/', optionalAuthenticate, subjectController.getSubjects);
router.post('/', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), subjectController.createSubject);
router.put('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), subjectController.updateSubject);
router.delete('/:id', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), subjectController.deleteSubject);

export default router;
