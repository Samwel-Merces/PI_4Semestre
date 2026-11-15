import {
  useState,
} from 'react';

import {
  authService,
} from '../services/auth.service';

import { useFormState } from './useFormState';

import {
  getApiErrorCode,
} from '../utils/error';

import type { SubmitOutcome } from '../utils/form';

import {
  validateRegisterForm,
  type RegisterValues,
} from '../utils/formRules';

import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from '../utils/validacoes';

export function useRegister() {
  const form = useFormState<RegisterValues>({
    initialValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirmation: '',
    },
    validate: validateRegisterForm,
  });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  /* Em caso de sucesso, devolve o e-mail normalizado para preencher o login. */
  async function handleRegister(): Promise<
    SubmitOutcome<keyof RegisterValues, string>
  > {
    const invalidField = form.validateAll();

    if (invalidField) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      const email = normalizeEmail(form.values.email);

      try {
        await authService.register({
          name: normalizeName(form.values.name),
          email,
          phone: normalizePhone(form.values.phone),
          password: form.values.password,
        });

        return { ok: true as const, result: email };
      } catch (error: unknown) {
        const emailInUse =
          getApiErrorCode(error) === 'EMAIL_IN_USE';

        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            'Não foi possível realizar o cadastro.',
            emailInUse
              ? { email: 'Este e-mail já está cadastrado.' }
              : {},
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
    handleRegister,
  };
}
