import {
  useState,
} from 'react';

import {
  authService,
} from '../services/auth.service';

import { useFormState } from './useFormState';

import type { SubmitOutcome } from '../utils/form';

import {
  validateResetPasswordForm,
  type ResetPasswordValues,
} from '../utils/formRules';

interface UseResetPasswordProps {
  token: string;
}

export function useResetPassword({
  token,
}: UseResetPasswordProps) {
  const form = useFormState<ResetPasswordValues>({
    initialValues: {
      password: '',
      passwordConfirmation: '',
    },
    validate: validateResetPasswordForm,
  });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  /* Em caso de sucesso, devolve a mensagem para exibir no login. */
  async function handleResetPassword(): Promise<
    SubmitOutcome<keyof ResetPasswordValues, string>
  > {
    const invalidField = form.validateAll();

    if (invalidField) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    if (!token) {
      setErrorMessage('Token de recuperação não informado.');

      return { ok: false, invalidField: null };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      try {
        const result =
          await authService.resetPassword({
            token,
            password: form.values.password,
          });

        return {
          ok: true as const,
          result:
            result.message ||
            'Senha alterada com sucesso.',
        };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            'Não foi possível alterar a senha.',
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
    handleResetPassword,
  };
}
