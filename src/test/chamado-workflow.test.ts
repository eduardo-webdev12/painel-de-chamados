import { describe, expect, it } from "vitest";
import { montarPayloadEncerramento } from "@/lib/chamadoWorkflow";

describe("montarPayloadEncerramento", () => {
  it("exige data/hora quando opção é destravou", () => {
    const result = montarPayloadEncerramento({
      opcao: "destravou",
      dataRetornoSinal: "",
      horaTravou: "2026-03-07T10:00:00.000Z",
    });

    expect(result.ok).toBe(false);
  });

  it("permite finalizar como continua travado sem data/hora", () => {
    const result = montarPayloadEncerramento({
      opcao: "continua_travado",
      dataRetornoSinal: "",
      horaTravou: "2026-03-07T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updates.status).toBe("Encerrado — Continua travado");
      expect(result.updates.data_hora_retorno_sinal).toBeNull();
    }
  });

  it("permite finalizar como sem cobertura sem data/hora", () => {
    const result = montarPayloadEncerramento({
      opcao: "sem_cobertura",
      dataRetornoSinal: "",
      horaTravou: "2026-03-07T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updates.status).toBe("Encerrado — Sem cobertura");
      expect(result.updates.data_hora_retorno_sinal).toBeNull();
    }
  });
});
