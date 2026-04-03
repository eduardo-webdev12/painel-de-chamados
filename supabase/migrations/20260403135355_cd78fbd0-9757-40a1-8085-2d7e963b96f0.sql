
-- Tabela para controle de integrações fora do ar
CREATE TABLE public.tecnologia_integracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tecnologia TEXT NOT NULL,
  data_hora_queda TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_hora_retorno TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'Fora do ar',
  observacao TEXT,
  registrado_por UUID,
  registrado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tecnologia_integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view integracoes" ON public.tecnologia_integracoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/gerente can insert integracoes" ON public.tecnologia_integracoes
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'lider') OR public.has_role(auth.uid(), 'operador')
  );

CREATE POLICY "Admin/gerente can update integracoes" ON public.tecnologia_integracoes
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'lider')
  );

CREATE POLICY "Admin can delete integracoes" ON public.tecnologia_integracoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tecnologia_integracoes_updated_at
  BEFORE UPDATE ON public.tecnologia_integracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo ativo na tabela profiles
ALTER TABLE public.profiles ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tecnologia_integracoes;
