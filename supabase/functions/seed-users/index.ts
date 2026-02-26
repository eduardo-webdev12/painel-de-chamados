import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USERS = [
  { email: "eduardo.lima@vxconsult.com.br", password: "Eduardo7070#", nome: "Eduardo Lima", role: "admin", cargo: "SAC VX INTEGRAÇÕES (Administrador)" },
  { email: "matheus.vieira@vxconsult.com.br", password: "monitoramento@2026", nome: "Matheus Vieira", role: "gerente", cargo: "Gerente Geral de Operações" },
  { email: "felipe@vxconsult.com.br", password: "monitoramento@2026", nome: "Felipe", role: "lider", cargo: "Líder de Monitoramento" },
  { email: "cibele@vxconsult.com.br", password: "monitoramento@2026", nome: "Cibele", role: "lider", cargo: "Líder de Monitoramento" },
  { email: "brenda@vxconsult.com.br", password: "monitoramento@2026", nome: "Brenda", role: "operador", cargo: "Operador" },
  { email: "rafael@vxconsult.com.br", password: "monitoramento@2026", nome: "Rafael", role: "operador", cargo: "Operador" },
  { email: "karina@vxconsult.com.br", password: "monitoramento@2026", nome: "Karina", role: "operador", cargo: "Operador" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results = [];

    for (const user of USERS) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === user.email);
      
      if (existing) {
        // Ensure role exists
        const { data: roleExists } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", existing.id)
          .maybeSingle();
        
        if (!roleExists) {
          await supabaseAdmin.from("user_roles").insert({
            user_id: existing.id,
            role: user.role,
            cargo_display: user.cargo,
          });
        }
        results.push({ email: user.email, status: "already_exists" });
        continue;
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { nome: user.nome },
      });

      if (authError) {
        results.push({ email: user.email, status: "error", error: authError.message });
        continue;
      }

      // Insert role
      await supabaseAdmin.from("user_roles").insert({
        user_id: authData.user.id,
        role: user.role,
        cargo_display: user.cargo,
      });

      results.push({ email: user.email, status: "created" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
