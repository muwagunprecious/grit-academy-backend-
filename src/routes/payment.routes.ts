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
router.get('/history', paymentController.getPaymentHistory);

// Admin-only route
router.get('/all', requireRole('ADMIN', 'SUPER_ADMIN'), paymentController.getAllPayments);

export default router;
