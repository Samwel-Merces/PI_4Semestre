import {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  getApiErrorMessage,
  getApiFieldErrors,
} from '../utils/error';

import {
  getFirstInvalidField,
  getVisibleErrors,
  isFormDirty,
  runExclusive,
  type FieldErrors,
  type TouchedFields,
} from '../utils/form';

export type FormField<Values> = Extract<keyof Values, string>;

interface UseFormStateOptions<Values extends Record<string, unknown>> {
  initialValues: Values;
  validate: (values: Values) => FieldErrors<FormField<Values>>;
}

/*
 * Estado genérico de formulário:
 * - valida o campo após o blur ou após a primeira tentativa de envio;
 * - não mostra erros na abertura da tela;
 * - remove o erro assim que o valor passa a ser válido;
 * - mantém os valores digitados quando a API retorna erro;
 * - informa se o formulário foi modificado (para confirmar descarte);
 * - impede envio duplicado enquanto a requisição está em andamento.
 * As regras de cada campo ficam em utils/validacoes.ts e utils/formRules.ts.
 */
export function useFormState<Values extends Record<string, unknown>>({
  initialValues,
  validate,
}: UseFormStateOptions<Values>) {
  type Field = FormField<Values>;

  const [values, setValues] = useState<Values>(initialValues);
  const [baseline, setBaseline] = useState<Values>(initialValues);
  const [touched, setTouched] = useState<TouchedFields<Field>>({});
  const [apiErrors, setApiErrors] = useState<FieldErrors<Field>>({});
  const [submitting, setSubmitting] = useState(false);

  const submitLock = useRef(false);

  const fieldOrder = Object.keys(initialValues) as Field[];
  const validationErrors = validate(values);
  const errors = getVisibleErrors(validationErrors, touched, apiErrors);
  const isDirty = isFormDirty(baseline, values);

  const setValue = useCallback(
    <Key extends Field>(field: Key, value: Values[Key]): void => {
      setValues((current) => ({ ...current, [field]: value }));

      setApiErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const next = { ...current };
        delete next[field];

        return next;
      });
    },
    [],
  );

  /* Chamado no blur: a partir daqui o erro do campo passa a ser exibido. */
  const touch = useCallback((field: Field): void => {
    setTouched((current) =>
      current[field] ? current : { ...current, [field]: true },
    );
  }, []);

  /* Marca todos os campos como tocados e devolve o primeiro inválido. */
  function validateAll(): Field | null {
    const allTouched: TouchedFields<Field> = {};

    for (const field of fieldOrder) {
      allTouched[field] = true;
    }

    setTouched(allTouched);

    return getFirstInvalidField(fieldOrder, validationErrors);
  }

  /* Recarrega o formulário com novos valores iniciais (ex.: dados da API). */
  const reset = useCallback((nextValues: Values): void => {
    setValues(nextValues);
    setBaseline(nextValues);
    setTouched({});
    setApiErrors({});
  }, []);

  /*
   * Distribui os erros de validação da API (400 do Zod) pelos campos e
   * devolve a mensagem geral para o FeedbackMessage, junto com o primeiro
   * campo afetado.
   */
  function applyApiError(
    error: unknown,
    fallbackMessage: string,
    extraFieldErrors: FieldErrors<Field> = {},
  ): { message: string; invalidField: Field | null } {
    const fieldErrors: FieldErrors<Field> = {
      ...getApiFieldErrors(error, fieldOrder),
      ...extraFieldErrors,
    };

    setApiErrors(fieldErrors);

    return {
      message: getApiErrorMessage(error, fallbackMessage),
      invalidField: getFirstInvalidField(fieldOrder, fieldErrors),
    };
  }

  /* Executa o envio uma única vez por vez, controlando "submitting". */
  async function submit<Result>(
    task: () => Promise<Result>,
  ): Promise<Result | undefined> {
    return runExclusive(submitLock, async () => {
      setSubmitting(true);

      try {
        return await task();
      } finally {
        setSubmitting(false);
      }
    });
  }

  /* Propriedades comuns de um campo de texto: valor, edição, blur e erro. */
  function fieldProps<Key extends Field>(field: Key) {
    return {
      value: values[field],
      errorMessage: errors[field],
      onBlur: () => touch(field),
    };
  }

  return {
    values,
    errors,
    isDirty,
    submitting,
    fieldOrder,
    setValue,
    touch,
    validateAll,
    reset,
    applyApiError,
    submit,
    fieldProps,
  };
}
