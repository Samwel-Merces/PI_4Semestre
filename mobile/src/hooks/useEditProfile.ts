import { useState } from 'react';

import { authService } from '../services/auth.service';

import { getApiErrorCode } from '../utils/error';
import type { SubmitOutcome } from '../utils/form';

import {
  validatePasswordChangeForm,
  validateProfileForm,
  type PasswordChangeValues,
  type ProfileValues,
} from '../utils/formRules';

import {
  formatPhone,
  normalizeName,
  normalizePhone,
} from '../utils/validacoes';

import { useAuth } from './useAuth';
import { useFormState } from './useFormState';

const emptyPasswordChange: PasswordChangeValues = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
};

export function useEditProfile() {
  const { user, refreshUser } = useAuth();

  const profileForm = useFormState<ProfileValues>({
    initialValues: {
      name: user?.name ?? '',
      phone: formatPhone(user?.phone ?? ''),
    },
    validate: validateProfileForm,
  });

  const passwordForm = useFormState<PasswordChangeValues>({
    initialValues: emptyPasswordChange,
    validate: validatePasswordChangeForm,
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const saving = profileForm.submitting || passwordForm.submitting;
  const isDirty = profileForm.isDirty || passwordForm.isDirty;

  async function saveProfile(): Promise<
    SubmitOutcome<keyof ProfileValues>
  > {
    setSuccessMessage('');

    const invalidField = profileForm.validateAll();

    if (invalidField) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await profileForm.submit(async () => {
      setErrorMessage('');

      const values: ProfileValues = {
        name: normalizeName(profileForm.values.name),
        phone: normalizePhone(profileForm.values.phone),
      };

      try {
        await authService.updateProfile(values);
        await refreshUser().catch(() => undefined);

        profileForm.reset({
          name: values.name,
          phone: formatPhone(values.phone),
        });

        setSuccessMessage('Dados atualizados com sucesso.');

        return { ok: true as const, result: true as const };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          profileForm.applyApiError(
            error,
            'Não foi possível atualizar os dados.',
          );

        setErrorMessage(message);

        return { ok: false as const, invalidField: apiField };
      }
    });

    return outcome ?? { ok: false, invalidField: null };
  }

  async function changePassword(): Promise<
    SubmitOutcome<keyof PasswordChangeValues>
  > {
    setSuccessMessage('');

    const invalidField = passwordForm.validateAll();

    if (invalidField) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await passwordForm.submit(async () => {
      setErrorMessage('');

      try {
        await authService.updateProfile({
          currentPassword: passwordForm.values.currentPassword,
          newPassword: passwordForm.values.newPassword,
        });

        passwordForm.reset(emptyPasswordChange);
        setSuccessMessage('Senha alterada com sucesso.');

        return { ok: true as const, result: true as const };
      } catch (error: unknown) {
        const wrongCurrentPassword =
          getApiErrorCode(error) === 'INVALID_CURRENT_PASSWORD';

        const { message, invalidField: apiField } =
          passwordForm.applyApiError(
            error,
            'Não foi possível alterar a senha.',
            wrongCurrentPassword
              ? { currentPassword: 'A senha atual está incorreta.' }
              : {},
          );

        setErrorMessage(message);

        return { ok: false as const, invalidField: apiField };
      }
    });

    return outcome ?? { ok: false, invalidField: null };
  }

  return {
    profileForm,
    passwordForm,
    saving,
    isDirty,
    errorMessage,
    successMessage,
    saveProfile,
    changePassword,
  };
}
