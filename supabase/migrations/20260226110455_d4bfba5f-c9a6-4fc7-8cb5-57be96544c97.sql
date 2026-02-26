
-- Add creator identification columns to chamados
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS created_by_email text;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS created_by_role text;
