import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import combinationRouter from './routes/combination.routes.js';
import subjectRouter from './routes/subject.routes.js';
import testRouter from './routes/test.routes.js';
import questionRouter from './routes/question.routes.js';
import paymentRouter from './routes/payment.routes.js';
import pdfRouter from './routes/pdf.routes.js';
import aiRouter from './routes/ai.routes.js';
import attemptRouter from './routes/attempt.routes.js';
import analyticsRouter from './routes/analytics.routes.js';

import { AppError } from './utils/errors.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
// @ts-ignore - helmet v8 ESM/CJS compat (TS 5.9 strict)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS setup
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Parse body & cookies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Rate Limiting
// @ts-ignore - express-rate-limit v7 ESM/CJS compat (TS 5.9 strict)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
app.use('/api/', limiter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/combinations', combinationRouter);
app.use('/api/subjects', subjectRouter);
app.use('/api/tests', testRouter);
app.use('/api/questions', questionRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/pdfs', pdfRouter);
app.use('/api/ai', aiRouter);
app.use('/api/attempts', attemptRouter);
app.use('/api/analytics', analyticsRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Log server errors
  if (statusCode === 500) {
    console.error('SERVER ERROR:', err);
  }

  res.status(statusCode).json({
    status,
    message: err.message || 'Internal Server Error',
  });
});

// For local development
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Grit Academy API Server is running on port ${PORT}`);
  });
}

export default app;
