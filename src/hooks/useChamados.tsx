import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ChamadoDB = Tables<"chamados">;

export function useChamados() {
  const [chamados, setChamados] = useState<ChamadoDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChamados = useCallback(async () => {
    const { data } = await supabase
      .from("chamados")
      .select("*")
      .order("data_abertura", { ascending: false });
    setChamados(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChamados();

    const channel = supabase
      .channel("chamados-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, () => {
        fetchChamados();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchChamados]);

  return { chamados, loading, refetch: fetchChamados };
}
