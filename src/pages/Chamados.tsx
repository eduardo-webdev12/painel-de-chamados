import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { useChamados } from "@/hooks/useChamados";
import { Search } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Chamados() {
  const { chamados, loading } = useChamados();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTransportadora, setFiltroTransportadora] = useState("todas");
  const [filtroTecnologia, setFiltroTecnologia] = useState("todas");
  const [filtroData, setFiltroData] = useState("");

  const transportadoras = useMemo(() => [...new Set(chamados.map((c) => c.transportadora))].sort(), [chamados]);
  const tecnologias = useMemo(() => [...new Set(chamados.map((c) => c.tecnologia))].sort(), [chamados]);

  const filtrados = useMemo(() => {
    return chamados.filter((c) => {
      if (busca && !c.placa.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
      if (filtroTransportadora !== "todas" && c.transportadora !== filtroTransportadora) return false;
      if (filtroTecnologia !== "todas" && c.tecnologia !== filtroTecnologia) return false;
      if (filtroData && !c.data_abertura.startsWith(filtroData)) return false;
      return true;
    });
  }, [chamados, busca, filtroStatus, filtroTransportadora, filtroTecnologia, filtroData]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chamados</h1>
        <p className="text-sm text-muted-foreground">Lista completa de todos os chamados registrados</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por placa..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Tratativa">Em Tratativa</SelectItem>
                <SelectItem value="Resolvido">Resolvido</SelectItem>
                <SelectItem value="Encerrado — Continua travado">Continua Travado</SelectItem>
                <SelectItem value="Encerrado — Sem cobertura">Sem Cobertura</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroTransportadora} onValueChange={setFiltroTransportadora}>
              <SelectTrigger><SelectValue placeholder="Transportadora" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {transportadoras.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroTecnologia} onValueChange={setFiltroTecnologia}>
              <SelectTrigger><SelectValue placeholder="Tecnologia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {tecnologias.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum chamado encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Tecnologia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead>Finalizado por</TableHead>
                  <TableHead>Recorrente</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/chamados/${c.id}`)}>
                    <TableCell className="font-medium">{c.placa}</TableCell>
                    <TableCell>{c.transportadora}</TableCell>
                    <TableCell>{c.tecnologia}</TableCell>
                    <TableCell><StatusBadge status={c.status as any} /></TableCell>
                    <TableCell>
                      <div className="text-sm">{c.created_by_name || "—"}</div>
                      {c.created_by_role && <div className="text-xs text-muted-foreground">{c.created_by_role}</div>}
                    </TableCell>
                    <TableCell>
                      {c.finalizado_por_nome ? (
                        <>
                          <div className="text-sm">{c.finalizado_por_nome}</div>
                          {c.finalizado_por_cargo && <div className="text-xs text-muted-foreground">{c.finalizado_por_cargo}</div>}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{c.recorrente ? `Sim (${c.contagem_recorrencia}x)` : "Não"}</TableCell>
                    <TableCell className="text-muted-foreground">{format(parseISO(c.data_abertura), "dd/MM/yy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-4 text-sm text-muted-foreground">{filtrados.length} chamado{filtrados.length !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>
    </div>
  );
}
