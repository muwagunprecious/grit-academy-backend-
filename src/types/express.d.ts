import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}

export {};

declare module 'pdf-parse' {
  function pdf(dataBuffer: Buffer, options?: any): Promise<any>;
  export = pdf;
}
