
-- Add finalization tracking columns
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS finalizado_por_nome text,
  ADD COLUMN IF NOT EXISTS finalizado_por_email text,
  ADD COLUMN IF NOT EXISTS finalizado_por_cargo text,
  ADD COLUMN IF NOT EXISTS finalizado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_hora_retorno_sinal timestamp with time zone;
