import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticate);

// Student analytics
router.get('/student', analyticsController.getStudentAnalytics);

// Admin dashboard analytics
router.get('/admin', requireRole('ADMIN', 'SUPER_ADMIN'), analyticsController.getAdminAnalytics);
router.get('/admin/overview', requireRole('ADMIN', 'SUPER_ADMIN'), analyticsController.getAdminAnalytics);

// Test purchase audit
router.get('/test/:testId', requireRole('ADMIN', 'SUPER_ADMIN'), analyticsController.getTestPurchaseAnalytics);

export default router;
