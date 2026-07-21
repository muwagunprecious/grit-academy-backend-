-- Drop all conflicting tables from the previous project that's on this Supabase DB
-- This clears the way for the Grit Academy schema

-- Drop existing conflicting tables (from previous project)
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
DROP TABLE IF EXISTS public."Contestant" CASCADE;
DROP TABLE IF EXISTS public."Department" CASCADE;
DROP TABLE IF EXISTS public."Event" CASCADE;
DROP TABLE IF EXISTS public."Faculty" CASCADE;
DROP TABLE IF EXISTS public."Order" CASCADE;
DROP TABLE IF EXISTS public."OrderItem" CASCADE;
DROP TABLE IF EXISTS public."Payment" CASCADE;
DROP TABLE IF EXISTS public."Ticket" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public."Vote" CASCADE;
DROP TABLE IF EXISTS public."VoteCategory" CASCADE;

-- Drop conflicting enum types
DROP TYPE IF EXISTS public."PaymentStatus" CASCADE;
DROP TYPE IF EXISTS public."Role" CASCADE;
DROP TYPE IF EXISTS public."Difficulty" CASCADE;
DROP TYPE IF EXISTS public."QuestionType" CASCADE;
DROP TYPE IF EXISTS public."QuestionStatus" CASCADE;
DROP TYPE IF EXISTS public."AttemptStatus" CASCADE;
DROP TYPE IF EXISTS public."PdfStatus" CASCADE;
DROP TYPE IF EXISTS public."AttemptStatus" CASCADE;
