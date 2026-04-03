export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chamado_historico: {
        Row: {
          acao: string
          chamado_id: string
          created_at: string
          detalhes: string | null
          id: string
          usuario_cargo: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          chamado_id: string
          created_at?: string
          detalhes?: string | null
          id?: string
          usuario_cargo?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          chamado_id?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          usuario_cargo?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamado_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          anexo_foto_url: string | null
          contagem_recorrencia: number
          created_at: string
          created_by_email: string | null
          created_by_name: string | null
          created_by_role: string | null
          criado_por: string | null
          data_abertura: string
          data_hora_retorno_sinal: string | null
          data_posicao: string | null
          data_resolucao: string | null
          descricao: string
          finalizado_em: string | null
          finalizado_por_cargo: string | null
          finalizado_por_email: string | null
          finalizado_por_nome: string | null
          hora_travou: string | null
          id: string
          link_acompanhamento: string | null
          observacao: string | null
          observacao_tecnica: string | null
          placa: string
          recorrente: boolean
          status: string
          tecnologia: string
          tempo_travada: string
          transportadora: string
          updated_at: string
        }
        Insert: {
          anexo_foto_url?: string | null
          contagem_recorrencia?: number
          created_at?: string
          created_by_email?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          criado_por?: string | null
          data_abertura?: string
          data_hora_retorno_sinal?: string | null
          data_posicao?: string | null
          data_resolucao?: string | null
          descricao: string
          finalizado_em?: string | null
          finalizado_por_cargo?: string | null
          finalizado_por_email?: string | null
          finalizado_por_nome?: string | null
          hora_travou?: string | null
          id?: string
          link_acompanhamento?: string | null
          observacao?: string | null
          observacao_tecnica?: string | null
          placa: string
          recorrente?: boolean
          status?: string
          tecnologia: string
          tempo_travada: string
          transportadora: string
          updated_at?: string
        }
        Update: {
          anexo_foto_url?: string | null
          contagem_recorrencia?: number
          created_at?: string
          created_by_email?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          criado_por?: string | null
          data_abertura?: string
          data_hora_retorno_sinal?: string | null
          data_posicao?: string | null
          data_resolucao?: string | null
          descricao?: string
          finalizado_em?: string | null
          finalizado_por_cargo?: string | null
          finalizado_por_email?: string | null
          finalizado_por_nome?: string | null
          hora_travou?: string | null
          id?: string
          link_acompanhamento?: string | null
          observacao?: string | null
          observacao_tecnica?: string | null
          placa?: string
          recorrente?: boolean
          status?: string
          tecnologia?: string
          tempo_travada?: string
          transportadora?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tecnologia_contatos: {
        Row: {
          created_at: string
          id: string
          tecnologia: string
          updated_at: string
          whatsapp_numero: string
        }
        Insert: {
          created_at?: string
          id?: string
          tecnologia: string
          updated_at?: string
          whatsapp_numero: string
        }
        Update: {
          created_at?: string
          id?: string
          tecnologia?: string
          updated_at?: string
          whatsapp_numero?: string
        }
        Relationships: []
      }
      tecnologia_integracoes: {
        Row: {
          created_at: string
          data_hora_queda: string
          data_hora_retorno: string | null
          id: string
          observacao: string | null
          registrado_por: string | null
          registrado_por_nome: string | null
          status: string
          tecnologia: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hora_queda?: string
          data_hora_retorno?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          status?: string
          tecnologia: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hora_queda?: string
          data_hora_retorno?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          status?: string
          tecnologia?: string
          updated_at?: string
        }
        Relationships: []
      }
      transportadora_contatos: {
        Row: {
          created_at: string
          id: string
          transportadora: string
          updated_at: string
          whatsapp_numero: string
        }
        Insert: {
          created_at?: string
          id?: string
          transportadora: string
          updated_at?: string
          whatsapp_numero: string
        }
        Update: {
          created_at?: string
          id?: string
          transportadora?: string
          updated_at?: string
          whatsapp_numero?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          cargo_display: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          cargo_display?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          cargo_display?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gerente" | "lider" | "operador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente", "lider", "operador"],
    },
  },
} as const
