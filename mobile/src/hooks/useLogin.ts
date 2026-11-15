import {
  useEffect,
  useState,
} from 'react';

import { useAuth } from './useAuth';
import { useFormState } from './useFormState';

import type { LoginResponse } from '../types/auth';
import type { SubmitOutcome } from '../utils/form';

import {
  validateLoginForm,
  type LoginValues,
} from '../utils/formRules';

import { normalizeEmail } from '../utils/validacoes';

export function useLogin(initialEmail: string = '') {
  const { signIn } = useAuth();

  const form = useFormState<LoginValues>({
    initialValues: {
      email: initialEmail,
      password: '',
    },
    validate: validateLoginForm,
  });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const { reset } = form;

  /*
   * Ao voltar do cadastro ou da redefinição de senha, a tela de login já
   * está montada; o e-mail chega por parâmetro e substitui o formulário.
   */
  useEffect(() => {
    if (initialEmail) {
      reset({ email: initialEmail, password: '' });
      setErrorMessage('');
    }
  }, [initialEmail, reset]);

  async function handleLogin(): Promise<
    SubmitOutcome<keyof LoginValues, LoginResponse>
  > {
    const invalidField = form.validateAll();

    if (invalidField) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      try {
        const result = await signIn({
          email: normalizeEmail(form.values.email),
          password: form.values.password,
        });

        return { ok: true as const, result };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            'Não foi possível entrar.',
          );

        setErrorMessage(message);

        return { ok: false as const, invalidField: apiField };
      }
    });

    return outcome ?? { ok: false, invalidField: null };
  }

  return {
    form,
    loading: form.submitting,
    errorMessage,
    handleLogin,
  };
}
