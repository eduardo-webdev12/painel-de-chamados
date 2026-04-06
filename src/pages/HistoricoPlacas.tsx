import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useChamados } from "@/hooks/useChamados";
import { useNavigate } from "react-router-dom";
import { differenceInMinutes, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { analisarPlacas, RISCO_CONFIG, type PlacaRisco } from "@/lib/nocAnalytics";
import { Search, Car, Clock, RotateCcw, Cpu } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { formatDateTimeBrazil } from "@/lib/dateTime";

export default function HistoricoPlacas() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const placasRisco = useMemo(() => analisarPlacas(chamados), [chamados]);

  const placasAgrupadas = useMemo(() => {
    const map = new Map<string, typeof chamados>();
    chamados.forEach((c) => {
      const key = c.placa.trim().toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [chamados]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return placasRisco;
    const q = busca.trim().toUpperCase();
    return placasRisco.filter(p => p.placa.includes(q));
  }, [placasRisco, busca]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Placas</h1>
        <p className="text-sm text-muted-foreground">Histórico completo com análise de risco preditiva</p>
      </div>

      {/* Risk Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {(["critico", "alto", "medio", "baixo"] as const).map(nivel => {
          const count = placasRisco.filter(p => p.nivel === nivel).length;
          const cfg = RISCO_CONFIG[nivel];
          return (
            <Card key={nivel} className={`border ${cfg.bg}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <span className="text-2xl">{cfg.icon}</span>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar placa..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-4">
        {filtradas.map((pr, idx) => {
          const ocorrencias = placasAgrupadas.get(pr.placa) || [];
          const cfg = RISCO_CONFIG[pr.nivel];
          return (
            <motion.div key={pr.placa} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
              <Card className={`border-l-4 ${cfg.bg}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      <span className="font-mono">{pr.placa}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">{pr.totalOcorrencias} ocorrência{pr.totalOcorrencias > 1 ? "s" : ""}</span>
                  </CardTitle>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {pr.mtbfMinutos !== null && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />MTBF: {pr.mtbfMinutos < 60 ? `${Math.round(pr.mtbfMinutos)} min` : `${(pr.mtbfMinutos / 60).toFixed(1)} h`}</span>
                    )}
                    {pr.recorrencias > 0 && <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" />{pr.recorrencias} recorrências</span>}
                    <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{pr.tecnologias.join(", ")}</span>
                    {pr.tempoTravadaAtual > 0 && <span className="text-destructive font-medium">⏱ Travada agora: {pr.tempoTravadaAtual < 60 ? `${pr.tempoTravadaAtual} min` : `${(pr.tempoTravadaAtual / 60).toFixed(1)} h`}</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {ocorrencias.slice(0, 5).map(c => (
                      <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/50 px-2 rounded" onClick={() => navigate(`/chamados/${c.id}`)}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono">{formatDateTimeBrazil(c.data_abertura)}</span>
                          <span className="text-xs text-muted-foreground">{c.transportadora}</span>
                          <span className="text-xs text-muted-foreground">• {c.tecnologia}</span>
                          {c.created_by_name && <span className="text-xs text-muted-foreground">por {c.created_by_name}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {c.recorrente && <span className="text-[10px] text-orange-500">{c.contagem_recorrencia}x</span>}
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                    ))}
                    {ocorrencias.length > 5 && <p className="text-xs text-muted-foreground text-center pt-2">+{ocorrencias.length - 5} mais</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtradas.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma placa encontrada.</p>}
      </div>
    </div>
  );
}
