
-- Storage bucket for chamado attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chamado-anexos', 'chamado-anexos', true);

-- RLS for storage
CREATE POLICY "Authenticated users can upload chamado anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chamado-anexos');

CREATE POLICY "Anyone can view chamado anexos"
ON storage.objects FOR SELECT
USING (bucket_id = 'chamado-anexos');

CREATE POLICY "Authenticated users can delete own chamado anexos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chamado-anexos');

-- Add attachment fields to chamados
ALTER TABLE public.chamados
ADD COLUMN IF NOT EXISTS anexo_foto_url TEXT,
ADD COLUMN IF NOT EXISTS link_acompanhamento TEXT,
ADD COLUMN IF NOT EXISTS observacao_tecnica TEXT,
ADD COLUMN IF NOT EXISTS data_posicao TIMESTAMP WITH TIME ZONE;

-- Technology WhatsApp numbers table
CREATE TABLE public.tecnologia_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnologia TEXT NOT NULL UNIQUE,
  whatsapp_numero TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tecnologia_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tecnologia contatos"
ON public.tecnologia_contatos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and gerentes can manage tecnologia contatos"
ON public.tecnologia_contatos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins and gerentes can update tecnologia contatos"
ON public.tecnologia_contatos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins can delete tecnologia contatos"
ON public.tecnologia_contatos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
