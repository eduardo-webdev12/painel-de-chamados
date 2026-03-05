import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados } from "@/hooks/useChamados";
import { useNavigate } from "react-router-dom";
import { differenceInMinutes, parseISO } from "date-fns";
import { Radio, Clock, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Monitoramento() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const ativos = useMemo(() =>
    chamados
      .filter(c => c.status === "Aberto" || c.status === "Em Tratativa")
      .map(c => {
        const minutos = c.hora_travou ? differenceInMinutes(now, parseISO(c.hora_travou)) : 0;
        const tempo = minutos < 60 ? `${minutos} min` : `${(minutos / 60).toFixed(1)} h`;
        const critico = minutos > 240;
        return { ...c, minutos, tempoAtual: tempo, critico };
      })
      .sort((a, b) => b.minutos - a.minutos),
    [chamados, now]
  );

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-destructive animate-pulse" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoramento em Tempo Real</h1>
          <p className="text-sm text-muted-foreground">{ativos.length} placa{ativos.length !== 1 ? "s" : ""} travada{ativos.length !== 1 ? "s" : ""} agora</p>
        </div>
      </div>

      {ativos.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Nenhuma placa travada no momento 🎉</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {ativos.map(c => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} layout>
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${c.critico ? "border-destructive bg-destructive/5" : ""}`}
                  onClick={() => navigate(`/chamados/${c.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      {c.critico && <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />}
                      <div>
                        <p className="font-mono font-bold">{c.placa}</p>
                        <p className="text-xs text-muted-foreground">{c.transportadora} • {c.tecnologia}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold text-lg ${c.critico ? "text-destructive" : ""}`}>
                          <Clock className="inline h-4 w-4 mr-1" />{c.tempoAtual}
                        </p>
                        <p className="text-xs text-muted-foreground">travada</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
