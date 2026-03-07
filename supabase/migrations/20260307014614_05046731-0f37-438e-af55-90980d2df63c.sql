ALTER TABLE public.chamados
DROP CONSTRAINT IF EXISTS chamados_status_check;

ALTER TABLE public.chamados
ADD CONSTRAINT chamados_status_check
CHECK (
  status = ANY (
    ARRAY[
      'Aberto'::text,
      'Em Tratativa'::text,
      'Resolvido'::text,
      'Encerrado — Continua travado'::text,
      'Encerrado — Sem cobertura'::text,
      'Encerrado - Continua travado'::text,
      'Encerrado - Sem cobertura'::text
    ]
  )
);