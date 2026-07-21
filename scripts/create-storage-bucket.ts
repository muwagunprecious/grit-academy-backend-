import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: { fetch },
    realtime: { transport: ws },
  }
);

async function createStorageBucket() {
  console.log('Creating Supabase storage bucket "pdfs"...');

  const { data: existingBuckets } = await supabase.storage.listBuckets();
  const bucketExists = existingBuckets?.some((b) => b.name === 'pdfs');

  if (bucketExists) {
    console.log('✅ Bucket "pdfs" already exists.');
    return;
  }

  const { data, error } = await supabase.storage.createBucket('pdfs', {
    public: true,
    fileSizeLimit: 52428800, // 50MB (Supabase free tier limit)
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  });

  if (error) {
    console.error('❌ Failed to create bucket:', error.message);
    process.exit(1);
  }

  console.log('✅ Bucket "pdfs" created successfully:', data);
}

createStorageBucket();
