export const SESSION_EXPIRED_MESSAGE =
  'Sua sessão expirou. Entre novamente para continuar.';

/*
 * Remove todos os dados da sessão salvos no aparelho.
 * Cada etapa é executada mesmo que outra falhe, para que o token nunca
 * fique para trás por causa de um erro no cache local.
 */
export async function clearStoredSession(
  steps: ReadonlyArray<() => Promise<void>>,
): Promise<void> {
  await Promise.allSettled(steps.map((step) => step()));
}

/*
 * Mensagem a exibir no login quando a API responde 401.
 * Só faz sentido avisar se havia alguém autenticado; um 401 de
 * "e-mail ou senha inválidos" na tela de login não é sessão expirada.
 */
export function getUnauthorizedNotice(
  hadAuthenticatedUser: boolean,
): string | null {
  return hadAuthenticatedUser ? SESSION_EXPIRED_MESSAGE : null;
}
