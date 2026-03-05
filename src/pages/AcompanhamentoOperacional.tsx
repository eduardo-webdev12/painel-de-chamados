import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados } from "@/hooks/useChamados";
import { useNavigate } from "react-router-dom";
import { differenceInMinutes, parseISO } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Clock, RotateCcw, Flame } from "lucide-react";
import { motion } from "framer-motion";

export default function AcompanhamentoOperacional() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();

  const ativos = useMemo(() => chamados.filter((c) => c.status === "Aberto" || c.status === "Em Tratativa"), [chamados]);
  const criticos = useMemo(() => ativos.filter((c) => {
    if (!c.hora_travou) return false;
    return differenceInMinutes(new Date(), parseISO(c.hora_travou)) > 240;
  }), [ativos]);
  const recorrentes = useMemo(() => chamados.filter((c) => c.recorrente), [chamados]);
  const maisTempoTravado = useMemo(() =>
    [...ativos].sort((a, b) => {
      const diffA = a.hora_travou ? differenceInMinutes(new Date(), parseISO(a.hora_travou)) : 0;
      const diffB = b.hora_travou ? differenceInMinutes(new Date(), parseISO(b.hora_travou)) : 0;
      return diffB - diffA;
    }).slice(0, 10), [ativos]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  const ChamadoRow = ({ c }: { c: typeof chamados[0] }) => {
    const tempo = c.hora_travou && (c.status === "Aberto" || c.status === "Em Tratativa")
      ? (() => { const d = differenceInMinutes(new Date(), parseISO(c.hora_travou)); return d < 60 ? `${d} min` : `${(d / 60).toFixed(1)} h`; })()
      : c.tempo_travada;
    return (
      <div className="flex items-center justify-between border-b py-2 last:border-0 cursor-pointer hover:bg-muted/50 px-2 rounded" onClick={() => navigate(`/chamados/${c.id}`)}>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-sm">{c.placa}</span>
          <span className="text-xs text-muted-foreground">{c.transportadora}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{tempo}</span>
          <StatusBadge status={c.status} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Acompanhamento Operacional</h1>
        <p className="text-sm text-muted-foreground">Visão em tempo real das ocorrências ativas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card><CardContent className="pt-6 text-center"><Clock className="mx-auto h-8 w-8 text-primary mb-2" /><p className="text-3xl font-bold">{ativos.length}</p><p className="text-xs text-muted-foreground">Chamados Ativos</p></CardContent></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={criticos.length > 0 ? "border-destructive" : ""}><CardContent className="pt-6 text-center"><Flame className="mx-auto h-8 w-8 text-destructive mb-2" /><p className="text-3xl font-bold">{criticos.length}</p><p className="text-xs text-muted-foreground">Críticos (&gt;4h)</p></CardContent></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card><CardContent className="pt-6 text-center"><RotateCcw className="mx-auto h-8 w-8 text-orange-500 mb-2" /><p className="text-3xl font-bold">{recorrentes.length}</p><p className="text-xs text-muted-foreground">Recorrentes</p></CardContent></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card><CardContent className="pt-6 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-yellow-500 mb-2" /><p className="text-3xl font-bold">{chamados.filter(c => c.status === "Em Tratativa").length}</p><p className="text-xs text-muted-foreground">Em Tratativa</p></CardContent></Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-destructive" />Chamados Críticos</CardTitle></CardHeader>
          <CardContent>{criticos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado crítico</p> : criticos.map(c => <ChamadoRow key={c.id} c={c} />)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Maior Tempo Travado</CardTitle></CardHeader>
          <CardContent>{maisTempoTravado.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado ativo</p> : maisTempoTravado.map(c => <ChamadoRow key={c.id} c={c} />)}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-orange-500" />Chamados Recorrentes</CardTitle></CardHeader>
          <CardContent>{recorrentes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado recorrente</p> : recorrentes.map(c => <ChamadoRow key={c.id} c={c} />)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
