import { StatusChamado } from "@/types/chamado";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<StatusChamado, { label: string; className: string }> = {
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
};

export function StatusBadge({ status }: { status: StatusChamado }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
