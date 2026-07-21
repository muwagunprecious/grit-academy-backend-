import { Router } from 'express';
import multer from 'multer';
import * as pdfController from '../controllers/pdf.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Setup Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/rtf',
    ];
    const isDocx = file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc') || file.originalname.endsWith('.pdf') || file.originalname.endsWith('.txt');
    if (allowedMimes.includes(file.mimetype) || isDocx) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Microsoft Word (.doc, .docx), or Text (.txt) files are allowed'));
    }
  },
});

router.use(authenticate);
router.use(requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/', pdfController.getPdfs);
router.post('/upload', upload.single('file'), pdfController.uploadPdf);
router.delete('/:id', pdfController.deletePdf);
router.post('/:id/process', pdfController.processPdf);

export default router;
