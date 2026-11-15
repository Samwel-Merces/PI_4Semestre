import type { UserRole } from '../types/auth';

export type NavigatorName =
  | 'loading'
  | 'auth'
  | 'admin'
  | 'client';

/*
 * Decide qual navegador o RootNavigator monta.
 * Enquanto a sessão é restaurada, mostra o carregamento para que a tela
 * de login não pisque antes de abrir a área autenticada.
 */
export function resolveNavigator(
  isLoadingSession: boolean,
  user: { role: UserRole } | null,
): NavigatorName {
  if (isLoadingSession) {
    return 'loading';
  }

  if (!user) {
    return 'auth';
  }

  return user.role === 'ADMIN' ? 'admin' : 'client';
}
