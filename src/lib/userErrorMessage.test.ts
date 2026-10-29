import { describe, expect, it } from "vitest";
import { userErrorMessage } from "./userErrorMessage";

describe("userErrorMessage", () => {
  it("esconde nomes de tabela, função e códigos do banco", () => {
    const texto = userErrorMessage(
      "[clientsRepository] falha ao buscar orbit.v_client_health: relation does not exist",
    );
    expect(texto).not.toMatch(/orbit|v_client|relation|\[/);
    expect(texto).toMatch(/Não conseguimos carregar/);
  });

  it("traduz falha de rede", () => {
    expect(userErrorMessage("TypeError: Failed to fetch")).toMatch(/conexão/);
  });

  it("traduz erros de login em inglês", () => {
    expect(userErrorMessage("Invalid login credentials")).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("troca mensagens vagas pela frase padrão", () => {
    expect(userErrorMessage("Erro desconhecido")).toMatch(/Tente de novo/);
    expect(userErrorMessage(null)).toMatch(/Tente de novo/);
  });

  it("usa o texto de reserva informado", () => {
    expect(userErrorMessage("", "Não foi possível entrar.")).toBe(
      "Não foi possível entrar.",
    );
  });

  it("mantém mensagens que já falam a língua do cliente", () => {
    expect(userErrorMessage("Não autenticado.")).toBe("Não autenticado.");
  });
});
