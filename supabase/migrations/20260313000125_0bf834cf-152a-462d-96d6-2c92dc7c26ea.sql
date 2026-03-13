CREATE TABLE IF NOT EXISTS public.transportadora_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transportadora text NOT NULL UNIQUE,
  whatsapp_numero text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transportadora_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transportadora contatos"
  ON public.transportadora_contatos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "All authenticated can insert transportadora contatos"
  ON public.transportadora_contatos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can update transportadora contatos"
  ON public.transportadora_contatos FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_transportadora_contatos_updated_at
  BEFORE UPDATE ON public.transportadora_contatos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();