
-- Tabela de histórico de interações dos chamados
CREATE TABLE public.chamado_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  detalhes TEXT,
  usuario_nome TEXT,
  usuario_email TEXT,
  usuario_cargo TEXT,
  usuario_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por chamado
CREATE INDEX idx_chamado_historico_chamado_id ON public.chamado_historico(chamado_id);

-- Enable RLS
ALTER TABLE public.chamado_historico ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver histórico
CREATE POLICY "Authenticated users can view historico"
  ON public.chamado_historico FOR SELECT
  USING (true);

-- Todos autenticados podem inserir histórico
CREATE POLICY "Authenticated users can insert historico"
  ON public.chamado_historico FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamado_historico;
