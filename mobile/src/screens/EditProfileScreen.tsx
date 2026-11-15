import { useRef } from 'react';

import {
  SafeAreaView,
  Text,
} from 'react-native';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import AppButton from '../components/AppButton';
import AppTextField, {
  type TextFieldRef,
} from '../components/AppTextField';
import FeedbackMessage from '../components/FeedbackMessage';
import FormScrollView from '../components/FormScrollView';
import PasswordInput from '../components/PasswordInput';
import ScreenHeader from '../components/ScreenHeader';
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { useEditProfile } from '../hooks/useEditProfile';
import { commonStyles as styles } from '../theme/commonStyles';
import { focusField } from '../utils/form';
import {
  formatPhone,
  limits,
} from '../utils/validacoes';

import type { ClientStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<
  ClientStackParamList,
  'EditProfile'
>;

export default function EditProfileScreen({
  navigation,
}: Props) {
  const {
    profileForm,
    passwordForm,
    saving,
    isDirty,
    errorMessage,
    successMessage,
    saveProfile,
    changePassword,
  } = useEditProfile();

  useDiscardConfirmation(isDirty);

  const nameRef = useRef<TextFieldRef>(null);
  const phoneRef = useRef<TextFieldRef>(null);
  const currentPasswordRef = useRef<TextFieldRef>(null);
  const newPasswordRef = useRef<TextFieldRef>(null);
  const confirmationRef = useRef<TextFieldRef>(null);

  async function handleSaveProfile(): Promise<void> {
    const outcome = await saveProfile();

    if (!outcome.ok) {
      focusField(
        { name: nameRef, phone: phoneRef },
        outcome.invalidField,
      );
    }
  }

  async function handleChangePassword(): Promise<void> {
    const outcome = await changePassword();

    if (!outcome.ok) {
      focusField(
        {
          currentPassword: currentPasswordRef,
          newPassword: newPasswordRef,
          newPasswordConfirmation: confirmationRef,
        },
        outcome.invalidField,
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Editar perfil"
        onBack={() => navigation.goBack()}
      />

      <FormScrollView contentContainerStyle={styles.formContent}>
        <AppTextField
          ref={nameRef}
          label="Nome"
          {...profileForm.fieldProps('name')}
          onChangeText={(value) => profileForm.setValue('name', value)}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={limits.userNameMax}
          editable={!saving}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />

        <AppTextField
          ref={phoneRef}
          label="Telefone"
          {...profileForm.fieldProps('phone')}
          onChangeText={(value) =>
            profileForm.setValue('phone', formatPhone(value))
          }
          placeholder="(11) 91234-5678"
          helperText="Com DDD."
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={limits.phoneInputMax}
          editable={!saving}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => {
            void handleSaveProfile();
          }}
        />

        <AppButton
          label="Salvar dados"
          loading={profileForm.submitting}
          loadingLabel="Salvando..."
          disabled={passwordForm.submitting}
          onPress={() => {
            void handleSaveProfile();
          }}
        />

        <Text
          style={[styles.cardTitle, { marginTop: 12 }]}
          accessibilityRole="header"
        >
          Alterar senha
        </Text>

        <PasswordInput
          ref={currentPasswordRef}
          label="Senha atual"
          {...passwordForm.fieldProps('currentPassword')}
          onChangeText={(value) =>
            passwordForm.setValue('currentPassword', value)
          }
          autoComplete="current-password"
          textContentType="password"
          editable={!saving}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => newPasswordRef.current?.focus()}
        />

        <PasswordInput
          ref={newPasswordRef}
          label="Nova senha"
          helperText="De 8 a 72 caracteres."
          {...passwordForm.fieldProps('newPassword')}
          onChangeText={(value) =>
            passwordForm.setValue('newPassword', value)
          }
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!saving}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmationRef.current?.focus()}
        />

        <PasswordInput
          ref={confirmationRef}
          label="Confirmar nova senha"
          {...passwordForm.fieldProps('newPasswordConfirmation')}
          onChangeText={(value) =>
            passwordForm.setValue('newPasswordConfirmation', value)
          }
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!saving}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => {
            void handleChangePassword();
          }}
        />

        <AppButton
          variant="outline"
          label="Alterar senha"
          loading={passwordForm.submitting}
          loadingLabel="Alterando..."
          disabled={profileForm.submitting}
          onPress={() => {
            void handleChangePassword();
          }}
        />

        <FeedbackMessage
          kind="error"
          message={errorMessage}
          style={styles.errorText}
        />

        <FeedbackMessage
          kind="success"
          message={successMessage}
        />
      </FormScrollView>
    </SafeAreaView>
  );
}
