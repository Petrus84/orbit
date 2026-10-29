/**
 * Mensagem de erro segura para o cliente final.
 *
 * Erros vindos do banco, da rede ou de validação trazem nomes de tabela,
 * códigos e trechos de SQL. O detalhe técnico continua no console (cada
 * repositório e hook já registra); a tela mostra só uma frase que o cliente
 * entende e sabe o que fazer a seguir.
 */

const MENSAGEM_GENERICA =
  "Não conseguimos carregar esses dados agora. Tente de novo em instantes; se continuar, fale com o suporte.";
const MENSAGEM_REDE =
  "Sem conexão com o servidor. Confira sua internet e tente de novo.";

const PADRAO_REDE =
  /failed to fetch|fetch failed|networkerror|network request|timed? ?out|econn|enotfound/i;
const PADRAO_SENHA = /invalid login credentials/i;
const PADRAO_EMAIL = /email not confirmed/i;
const PADRAO_VAGO = /^erro (desconhecido|inesperado)/i;
const PADRAO_TECNICO =
  /\[[\w.-]+\]|\b(orbit|public)\.\w+|\b(ig|v|fn)_[a-z_]+|\bPGRST\w*|postgres|supabase|\brelation\b|\bcolumn\b|\bconstraint\b|\bschema\b|\bpayload\b|\bzod\b|\bjwt\b|typeerror|undefined|[{}]|\bclientId\b|\bsql\b|\(\d{3}\)|\b\d{5}\b/i;

export function userErrorMessage(
  raw: string | null | undefined,
  fallback: string = MENSAGEM_GENERICA,
): string {
  const texto = (raw ?? "").trim();
  if (texto === "") return fallback;
  if (PADRAO_SENHA.test(texto)) return "E-mail ou senha incorretos.";
  if (PADRAO_EMAIL.test(texto)) return "Confirme seu e-mail antes de entrar.";
  if (PADRAO_REDE.test(texto)) return MENSAGEM_REDE;
  if (PADRAO_VAGO.test(texto) || PADRAO_TECNICO.test(texto)) return fallback;
  return texto;
}
