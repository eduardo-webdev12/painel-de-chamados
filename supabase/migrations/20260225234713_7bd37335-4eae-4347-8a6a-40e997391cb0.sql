
-- Fix overly permissive INSERT policy on chamados
DROP POLICY "Authenticated users can insert chamados" ON public.chamados;
CREATE POLICY "Authenticated users can insert chamados" ON public.chamados FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por);

-- Fix overly permissive UPDATE policy on chamados
DROP POLICY "Authenticated users can update chamados" ON public.chamados;
CREATE POLICY "Authenticated users can update chamados" ON public.chamados FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'lider') OR auth.uid() = criado_por
);
