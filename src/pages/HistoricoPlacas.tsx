import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useChamados } from "@/hooks/useChamados";
import { useNavigate } from "react-router-dom";
import { differenceInMinutes, parseISO } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Car } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default function HistoricoPlacas() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const placasAgrupadas = useMemo(() => {
    const map = new Map<string, typeof chamados>();
    chamados.forEach((c) => {
      const key = c.placa.trim().toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries())
      .map(([placa, ocorrencias]) => {
        const resolvidos = ocorrencias.filter(o => o.status === "Resolvido" || o.status.includes("Encerrado"));
        const tempos = resolvidos
          .filter(o => o.hora_travou && o.data_resolucao)
          .map(o => differenceInMinutes(parseISO(o.data_resolucao!), parseISO(o.hora_travou!)));
        const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
        const tecnologias = [...new Set(ocorrencias.map(o => o.tecnologia))];
        return { placa, ocorrencias, total: ocorrencias.length, tempoMedio, tecnologias };
      })
      .sort((a, b) => b.total - a.total);
  }, [chamados]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return placasAgrupadas;
    const q = busca.trim().toUpperCase();
    return placasAgrupadas.filter(p => p.placa.includes(q));
  }, [placasAgrupadas, busca]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Placas</h1>
        <p className="text-sm text-muted-foreground">Histórico completo por placa</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar placa..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
      </div>
      <div className="space-y-4">
        {filtradas.map(({ placa, ocorrencias, total, tempoMedio, tecnologias }) => (
          <Card key={placa}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Car className="h-5 w-5" />{placa}</span>
                <span className="text-sm font-normal text-muted-foreground">{total} ocorrência{total > 1 ? "s" : ""}</span>
              </CardTitle>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Tempo médio: {tempoMedio < 60 ? `${Math.round(tempoMedio)} min` : `${(tempoMedio / 60).toFixed(1)} h`}</span>
                <span>Tecnologias: {tecnologias.join(", ")}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {ocorrencias.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/50 px-2 rounded" onClick={() => navigate(`/chamados/${c.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{format(parseISO(c.data_abertura), "dd/MM/yy HH:mm")}</span>
                      <span className="text-xs text-muted-foreground">{c.transportadora}</span>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
                {ocorrencias.length > 5 && <p className="text-xs text-muted-foreground text-center pt-2">+{ocorrencias.length - 5} mais</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
