import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Users, Shield, Edit, Trash2, UserCheck, UserX, Save, X } from "lucide-react";

interface UserInfo {
  user_id: string;
  nome: string;
  email: string;
  role: string;
  cargo_display: string;
  ativo: boolean;
}

export default function GestaoUsuarios() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editNome, setEditNome] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email, ativo");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, cargo_display");
    const roleMap = new Map(roles?.map(r => [r.user_id, r]) || []);
    const merged = (profiles || []).map(p => ({
      user_id: p.user_id,
      nome: p.nome,
      email: p.email,
      role: (roleMap.get(p.user_id) as any)?.role || "operador",
      cargo_display: (roleMap.get(p.user_id) as any)?.cargo_display || "Operador",
      ativo: (p as any).ativo !== false,
    }));
    setUsers(merged);
    setLoading(false);
  };

  const handleEdit = (u: UserInfo) => {
    setEditingId(u.user_id);
    setEditRole(u.role);
    setEditCargo(u.cargo_display);
    setEditNome(u.nome);
  };

  const handleSave = async (userId: string) => {
    try {
      // Update role
      const { error: roleErr } = await supabase.from("user_roles").update({
        role: editRole as any,
        cargo_display: editCargo,
      }).eq("user_id", userId);
      if (roleErr) throw roleErr;

      // Update profile name
      const { error: profErr } = await supabase.from("profiles").update({
        nome: editNome,
      }).eq("user_id", userId);
      if (profErr) throw profErr;

      // Log
      await supabase.from("chamado_historico").insert({
        chamado_id: "00000000-0000-0000-0000-000000000000",
        acao: "Alteração de usuário",
        detalhes: `Usuário ${editNome} atualizado: role=${editRole}, cargo=${editCargo}`,
        usuario_id: user?.id,
        usuario_nome: profile?.nome,
        usuario_email: profile?.email,
        usuario_cargo: profile?.cargo,
      });

      toast({ title: "Usuário atualizado com sucesso" });
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleToggleAtivo = async (u: UserInfo) => {
    const newAtivo = !u.ativo;
    await supabase.from("profiles").update({ ativo: newAtivo } as any).eq("user_id", u.user_id);

    await supabase.from("chamado_historico").insert({
      chamado_id: "00000000-0000-0000-0000-000000000000",
      acao: newAtivo ? "Ativação de usuário" : "Desativação de usuário",
      detalhes: `Usuário ${u.nome} (${u.email}) ${newAtivo ? "ativado" : "desativado"}`,
      usuario_id: user?.id,
      usuario_nome: profile?.nome,
      usuario_email: profile?.email,
      usuario_cargo: profile?.cargo,
    });

    toast({ title: newAtivo ? "Usuário ativado" : "Usuário desativado" });
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Remove role first (foreign key dependency)
      const { error: roleErr } = await supabase.from("user_roles").delete().eq("user_id", deleteTarget.user_id);
      if (roleErr) throw roleErr;

      // Remove profile
      const { error: profErr } = await supabase.from("profiles").delete().eq("user_id", deleteTarget.user_id);
      if (profErr) throw profErr;

      // Log the action
      await supabase.from("chamado_historico").insert({
        chamado_id: "00000000-0000-0000-0000-000000000000",
        acao: "Exclusão de usuário",
        detalhes: `Usuário ${deleteTarget.nome} (${deleteTarget.email}) excluído por ${profile?.nome}`,
        usuario_id: user?.id,
        usuario_nome: profile?.nome,
        usuario_email: profile?.email,
        usuario_cargo: profile?.cargo,
      });

      // Remove from local state immediately
      setUsers(prev => prev.filter(u => u.user_id !== deleteTarget.user_id));
      toast({ title: "Usuário excluído do sistema com sucesso" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
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
        <p className="text-sm text-muted-foreground">Gerenciar permissões, cargos e status dos usuários</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold">{users.length}</p><p className="text-xs text-muted-foreground">Total de Usuários</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-green-600">{users.filter(u => u.ativo).length}</p><p className="text-xs text-muted-foreground">Ativos</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-red-600">{users.filter(u => !u.ativo).length}</p><p className="text-xs text-muted-foreground">Inativos</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.user_id} className={!u.ativo ? "opacity-60 border-dashed" : ""}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${u.ativo ? "bg-primary/10" : "bg-muted"}`}>
                  <Users className={`h-5 w-5 ${u.ativo ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  {editingId === u.user_id ? (
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 text-sm w-48" />
                  ) : (
                    <p className="font-medium text-sm">{u.nome}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {!u.ativo && <span className="text-xs text-red-500 font-medium">Inativo</span>}
                </div>
              </div>

              {editingId === u.user_id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="lider">Líder</SelectItem>
                      <SelectItem value="operador">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={editCargo} onChange={e => setEditCargo(e.target.value)} className="w-44 h-8" placeholder="Cargo display" />
                  <Button size="sm" onClick={() => handleSave(u.user_id)}><Save className="h-3 w-3 mr-1" />Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground"><Shield className="h-4 w-4" />{u.cargo_display}</span>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(u)} title="Editar"><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleToggleAtivo(u)} title={u.ativo ? "Desativar" : "Ativar"}>
                    {u.ativo ? <UserX className="h-4 w-4 text-yellow-600" /> : <UserCheck className="h-4 w-4 text-green-600" />}
                  </Button>
                  {u.user_id !== user?.id && (
                    <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(u)} title="Excluir" className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o usuário <strong>{deleteTarget?.nome}</strong> ({deleteTarget?.email})?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Excluir Definitivamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
