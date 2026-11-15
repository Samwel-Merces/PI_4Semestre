import {
  useState,
} from 'react';

import {
  authService,
} from '../services/auth.service';

import type {
  ForgotPasswordResponse,
} from '../types/auth';

import { useFormState } from './useFormState';

import type { SubmitOutcome } from '../utils/form';

import {
  validateForgotPasswordForm,
  type ForgotPasswordValues,
} from '../utils/formRules';

import { normalizeEmail } from '../utils/validacoes';

export function useForgotPassword() {
  const form = useFormState<ForgotPasswordValues>({
    initialValues: { email: '' },
    validate: validateForgotPasswordForm,
  });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  async function handleForgotPassword(): Promise<
    SubmitOutcome<
      keyof ForgotPasswordValues,
      ForgotPasswordResponse
    >
  > {
    setSuccessMessage('');

    const invalidField = form.validateAll();

    if (invalidField) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      try {
        const result =
          await authService.forgotPassword(
            normalizeEmail(form.values.email),
          );

        setSuccessMessage(
          result.message ||
            'Solicitação realizada com sucesso.',
        );

        return { ok: true as const, result };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            'Não foi possível solicitar a recuperação.',
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
    successMessage,
    handleForgotPassword,
  };
}
