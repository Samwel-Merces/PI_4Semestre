export type FieldErrors<Field extends PropertyKey> = Partial<
  Record<Field, string>
>;

export type TouchedFields<Field extends PropertyKey> = Partial<
  Record<Field, boolean>
>;

/*
 * Erros exibidos ao usuário: só os dos campos já tocados (blur) ou de
 * todos após uma tentativa de envio. Erros vindos da API aparecem até o
 * campo ser editado.
 */
export function getVisibleErrors<Field extends PropertyKey>(
  validationErrors: FieldErrors<Field>,
  touched: TouchedFields<Field>,
  apiErrors: FieldErrors<Field> = {},
): FieldErrors<Field> {
  const result: FieldErrors<Field> = { ...apiErrors };

  for (const field of Object.keys(validationErrors) as Field[]) {
    const message = validationErrors[field];

    if (touched[field] && message) {
      result[field] = message;
    }
  }

  return result;
}

export function getFirstInvalidField<Field extends PropertyKey>(
  order: readonly Field[],
  errors: FieldErrors<Field>,
): Field | null {
  return order.find((field) => Boolean(errors[field])) ?? null;
}

export function hasErrors<Field extends PropertyKey>(
  errors: FieldErrors<Field>,
): boolean {
  return Object.values(errors).some(Boolean);
}

/* Formulário modificado: algum valor difere do estado inicial. */
export function isFormDirty<Values extends Record<string, unknown>>(
  initial: Values,
  current: Values,
): boolean {
  return (Object.keys(current) as Array<keyof Values>).some(
    (field) => !Object.is(initial[field], current[field]),
  );
}

/*
 * Resultado de um envio de formulário. Em caso de falha, informa o
 * primeiro campo inválido para que a tela possa levar o foco até ele.
 */
export type SubmitOutcome<Field extends string, Result = true> =
  | { ok: true; result: Result }
  | { ok: false; invalidField: Field | null };

export interface FocusableRef {
  current: { focus(): void } | null;
}

/* Leva o foco ao campo indicado (normalmente o primeiro inválido). */
export function focusField<Field extends string>(
  refs: Partial<Record<Field, FocusableRef>>,
  field: Field | null,
): void {
  if (field) {
    refs[field]?.current?.focus();
  }
}

export interface SubmitLock {
  current: boolean;
}

/*
 * Executa a tarefa apenas se nenhuma outra estiver em andamento.
 * O estado "loading" do React só muda no próximo render; a trava em ref
 * impede que dois toques rápidos disparem duas requisições.
 * Retorna undefined quando a chamada é ignorada.
 */
export async function runExclusive<Result>(
  lock: SubmitLock,
  task: () => Promise<Result>,
): Promise<Result | undefined> {
  if (lock.current) {
    return undefined;
  }

  lock.current = true;

  try {
    return await task();
  } finally {
    lock.current = false;
  }
}
