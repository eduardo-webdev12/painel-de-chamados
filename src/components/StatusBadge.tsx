import { StatusChamado } from "@/types/chamado";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  Aberto: {
    label: "Aberto",
    className: "bg-status-open/15 text-status-open border-status-open/30 hover:bg-status-open/20",
  },
  "Em Tratativa": {
    label: "Em Tratativa",
    className: "bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30 hover:bg-status-in-progress/20",
  },
  Resolvido: {
    label: "Resolvido",
    className: "bg-status-resolved/15 text-status-resolved border-status-resolved/30 hover:bg-status-resolved/20",
  },
  "Encerrado — Continua travado": {
    label: "Continua Travado",
    className: "bg-status-locked/15 text-status-locked border-status-locked/30 hover:bg-status-locked/20",
  },
  "Encerrado — Sem cobertura": {
    label: "Sem Cobertura",
    className: "bg-status-nocoverage/15 text-status-nocoverage border-status-nocoverage/30 hover:bg-status-nocoverage/20",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", config.className)}>
      {config.label}
    </Badge>
  );
}
