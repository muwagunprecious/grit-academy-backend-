const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcHplbmNpaXlrbWRoenJoYW1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4NzI2NSwiZXhwIjoyMDk1NDYzMjY1fQ.C_7N4_AInddH6cHdxGQtQydvUioCI-xd4JiDKmTCNtI';
const supabaseUrl = 'https://tcpzenciiykmdhzrhamb.supabase.co';

async function dropConflictingTables() {
  // Tables that exist in public schema that conflict with our schema push
  // The public.users table has a FK to auth.users which is the problem
  const dropSQL = `
    DROP TABLE IF EXISTS public.users CASCADE;
    DROP TABLE IF EXISTS public.refresh_tokens CASCADE;
    DROP TABLE IF EXISTS public.announcements CASCADE;
    DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
    DROP TABLE IF EXISTS public.assignments CASCADE;
    DROP TABLE IF EXISTS public.attendance_records CASCADE;
    DROP TABLE IF EXISTS public.attendance_sessions CASCADE;
    DROP TABLE IF EXISTS public.audit_logs CASCADE;
    DROP TABLE IF EXISTS public.bookmarked_questions CASCADE;
    DROP TABLE IF EXISTS public.classes CASCADE;
    DROP TABLE IF EXISTS public.complaints CASCADE;
    DROP TABLE IF EXISTS public.courses CASCADE;
    DROP TABLE IF EXISTS public.faqs CASCADE;
    DROP TABLE IF EXISTS public.locations CASCADE;
    DROP TABLE IF EXISTS public.marketplace_pdfs CASCADE;
    DROP TABLE IF EXISTS public.purchases CASCADE;
    DROP TABLE IF EXISTS public.questions CASCADE;
    DROP TABLE IF EXISTS public.settings CASCADE;
    DROP TABLE IF EXISTS public.subject_combination_subjects CASCADE;
    DROP TABLE IF EXISTS public.subject_combinations CASCADE;
    DROP TABLE IF EXISTS public.system_settings CASCADE;
    DROP TABLE IF EXISTS public.test_attempts CASCADE;
    DROP TABLE IF EXISTS public.tests CASCADE;
    DROP TABLE IF EXISTS public.universities CASCADE;
    DROP TYPE IF EXISTS public."PaymentStatus" CASCADE;
    DROP TYPE IF EXISTS public."Role" CASCADE;
    DROP TYPE IF EXISTS public."Difficulty" CASCADE;
    DROP TYPE IF EXISTS public."QuestionType" CASCADE;
    DROP TYPE IF EXISTS public."QuestionStatus" CASCADE;
    DROP TYPE IF EXISTS public."AttemptStatus" CASCADE;
    DROP TYPE IF EXISTS public."PdfStatus" CASCADE;
  `;

  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    }
  });
  
  console.log('Supabase status:', response.status);
  
  // Use the pg REST API SQL endpoint
  const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: dropSQL }),
  });
  
  console.log('SQL response status:', sqlResponse.status);
  const text = await sqlResponse.text();
  console.log('Response:', text);
}

dropConflictingTables().catch(console.error);
