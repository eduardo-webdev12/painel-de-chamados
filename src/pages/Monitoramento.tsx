import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados } from "@/hooks/useChamados";
import { useNavigate } from "react-router-dom";
import { differenceInMinutes, parseISO } from "date-fns";
import { gerarAlertasTempo, type AlertLevel } from "@/lib/nocAnalytics";
import { Radio, Clock, AlertTriangle, Bell, Zap, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ALERT_COLORS: Record<AlertLevel, { border: string; text: string; bg: string }> = {
  amarelo: { border: "border-yellow-400/50", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/5" },
  vermelho: { border: "border-orange-500/50", text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/5" },
  critico: { border: "border-destructive/50", text: "text-destructive", bg: "bg-destructive/5" },
};

export default function Monitoramento() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

  const ativos = useMemo(() =>
    chamados
      .filter(c => c.status === "Aberto" || c.status === "Em Tratativa")
      .map(c => {
        const minutos = c.hora_travou ? differenceInMinutes(now, parseISO(c.hora_travou)) : 0;
        const tempo = minutos < 60 ? `${minutos} min` : `${(minutos / 60).toFixed(1)} h`;
        let alertLevel: AlertLevel | null = null;
        if (minutos >= 120) alertLevel = "critico";
        else if (minutos >= 60) alertLevel = "vermelho";
        else if (minutos >= 30) alertLevel = "amarelo";
        return { ...c, minutos, tempoAtual: tempo, alertLevel };
      })
      .sort((a, b) => b.minutos - a.minutos),
    [chamados, now]
  );

  const alertas = useMemo(() => gerarAlertasTempo(chamados), [chamados]);
  const criticos = alertas.filter(a => a.level === "critico").length;
  const vermelhos = alertas.filter(a => a.level === "vermelho").length;

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

      {/* Alert Summary */}
      {alertas.length > 0 && (
        <div className="grid gap-3 grid-cols-3">
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{criticos}</p>
                <p className="text-xs text-muted-foreground">Críticos (&gt;2h)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4 flex items-center gap-3">
              <Bell className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{vermelhos}</p>
                <p className="text-xs text-muted-foreground">Atenção (&gt;1h)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{ativos.length}</p>
                <p className="text-xs text-muted-foreground">Total ativas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {ativos.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Nenhuma placa travada no momento 🎉</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {ativos.map(c => {
              const alertStyle = c.alertLevel ? ALERT_COLORS[c.alertLevel] : null;
              return (
                <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} layout>
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md ${alertStyle ? `${alertStyle.border} ${alertStyle.bg}` : ""}`}
                    onClick={() => navigate(`/chamados/${c.id}`)}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        {c.alertLevel === "critico" && <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />}
                        {c.alertLevel === "vermelho" && <Zap className="h-5 w-5 text-orange-500" />}
                        {c.alertLevel === "amarelo" && <Bell className="h-5 w-5 text-yellow-500" />}
                        <div>
                          <p className="font-mono font-bold">{c.placa}</p>
                          <p className="text-xs text-muted-foreground">{c.transportadora} • {c.tecnologia}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-bold text-lg ${alertStyle?.text || ""}`}>
                            <Clock className="inline h-4 w-4 mr-1" />{c.tempoAtual}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.alertLevel === "critico" ? "⚠️ CRÍTICO" : c.alertLevel === "vermelho" ? "⚠ Alerta" : c.alertLevel === "amarelo" ? "Atenção" : "travada"}
                          </p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
