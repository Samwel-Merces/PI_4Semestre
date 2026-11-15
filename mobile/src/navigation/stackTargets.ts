export type StackTargetAction = 'popTo' | 'replace';

/*
 * Se a tela de destino já está na pilha, volta até ela (sem criar outra
 * instância); caso contrário, substitui a tela atual.
 */
export function resolveStackTarget(
  routes: ReadonlyArray<{ name: string }>,
  name: string,
): StackTargetAction {
  return routes.some((route) => route.name === name)
    ? 'popTo'
    : 'replace';
}
