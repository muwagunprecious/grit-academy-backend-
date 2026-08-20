import { Router } from 'express';
import { z } from 'zod';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const initializeSchema = z.object({
  body: z.object({
    testId: z.string().min(1, 'Test ID is required'),
  }),
});

const verifySchema = z.object({
  body: z.object({
    reference: z.string().min(1, 'Reference is required'),
  }),
});

// Public Webhook Route for Paystack
router.post('/webhook', paymentController.handleWebhook);

router.use(authenticate);

router.post('/initialize', validate(initializeSchema), paymentController.initializePayment);
router.post('/verify', validate(verifySchema), paymentController.verifyPayment);
router.post('/apply-coupon', paymentController.applyCoupon);
router.get('/history', paymentController.getPaymentHistory);

// Admin / Authenticated routes
router.get('/all', requireRole('ADMIN', 'SUPER_ADMIN'), paymentController.getAllPayments);
router.post('/sync-pending', paymentController.syncPendingPayments);
router.post('/manual-unlock', requireRole('ADMIN', 'SUPER_ADMIN'), paymentController.manualUnlock);

export default router;
