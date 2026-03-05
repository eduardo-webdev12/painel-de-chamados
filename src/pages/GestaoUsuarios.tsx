import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Users, Shield, Edit } from "lucide-react";

interface UserInfo {
  user_id: string;
  nome: string;
  email: string;
  role: string;
  cargo_display: string;
}

export default function GestaoUsuarios() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCargo, setEditCargo] = useState("");

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, cargo_display");
    
    const roleMap = new Map(roles?.map(r => [r.user_id, r]) || []);
    const merged = (profiles || []).map(p => ({
      user_id: p.user_id,
      nome: p.nome,
      email: p.email,
      role: (roleMap.get(p.user_id) as any)?.role || "operador",
      cargo_display: (roleMap.get(p.user_id) as any)?.cargo_display || "Operador",
    }));
    setUsers(merged);
    setLoading(false);
  };

  const handleEdit = (u: UserInfo) => {
    setEditingId(u.user_id);
    setEditRole(u.role);
    setEditCargo(u.cargo_display);
  };

  const handleSave = async (userId: string) => {
    try {
      const { error } = await supabase.from("user_roles").update({
        role: editRole as any,
        cargo_display: editCargo,
      }).eq("user_id", userId);
      if (error) throw error;
      toast({ title: "Usuário atualizado" });
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground">Gerenciar permissões e cargos</p>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.user_id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{u.nome}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              {editingId === u.user_id ? (
                <div className="flex items-center gap-2">
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="lider">Líder</SelectItem>
                      <SelectItem value="operador">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={editCargo} onChange={e => setEditCargo(e.target.value)} className="w-48" placeholder="Cargo display" />
                  <Button size="sm" onClick={() => handleSave(u.user_id)}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-sm"><Shield className="h-4 w-4" />{u.cargo_display}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(u)}><Edit className="h-4 w-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
