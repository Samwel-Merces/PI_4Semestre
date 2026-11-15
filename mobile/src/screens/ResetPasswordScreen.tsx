import { useRef } from 'react';

import {
  SafeAreaView,
  Text,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AppButton from '../components/AppButton';
import FeedbackMessage from '../components/FeedbackMessage';
import { type TextFieldRef } from '../components/AppTextField';
import FormScrollView from '../components/FormScrollView';
import PasswordInput from '../components/PasswordInput';
import ScreenTitle from '../components/ScreenTitle';
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { useResetPassword } from '../hooks/useResetPassword';
import { authStyles as styles } from '../theme/authStyles';
import type { AuthStackParamList } from '../types/navigation';
import { focusField } from '../utils/form';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'ResetPassword'
>;

export default function ResetPasswordScreen({
  navigation,
  route,
}: Props) {
  const { token } = route.params;

  const {
    form,
    loading,
    errorMessage,
    handleResetPassword,
  } = useResetPassword({
    token,
  });

  const { allowLeave } = useDiscardConfirmation(form.isDirty);

  const passwordRef = useRef<TextFieldRef>(null);
  const confirmationRef = useRef<TextFieldRef>(null);

  async function onResetPasswordPress() {
    const outcome = await handleResetPassword();

    if (!outcome.ok) {
      focusField(
        {
          password: passwordRef,
          passwordConfirmation: confirmationRef,
        },
        outcome.invalidField,
      );

      return;
    }

    /* Volta ao login existente, descartando recuperação e redefinição. */
    allowLeave();

    navigation.popTo('Login', {
      successMessage: `${outcome.result} Entre com a nova senha.`,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <FormScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logo}>
          PETSHOP
        </Text>

        <ScreenTitle style={styles.title}>
          Criar nova senha
        </ScreenTitle>

        <Text style={styles.subtitle}>
          Escolha uma nova senha para acessar
          sua conta.
        </Text>

        <View style={styles.form}>
          <PasswordInput
            ref={passwordRef}
            label="Nova senha"
            placeholder="Digite a nova senha"
            helperText="De 8 a 72 caracteres."
            autoComplete="new-password"
            textContentType="newPassword"
            {...form.fieldProps('password')}
            onChangeText={(value) => form.setValue('password', value)}
            editable={!loading}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmationRef.current?.focus()}
          />

          <PasswordInput
            ref={confirmationRef}
            label="Confirmar nova senha"
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            textContentType="newPassword"
            {...form.fieldProps('passwordConfirmation')}
            onChangeText={(value) =>
              form.setValue('passwordConfirmation', value)
            }
            editable={!loading}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => {
              void onResetPasswordPress();
            }}
          />

          <FeedbackMessage
            kind="error"
            message={errorMessage}
          />

          <AppButton
            size="large"
            label="Alterar senha"
            loading={loading}
            loadingLabel="Alterando..."
            onPress={() => {
              void onResetPasswordPress();
            }}
            style={{ marginTop: 8 }}
          />

          <AppButton
            variant="link"
            label="Voltar para o login"
            disabled={loading}
            onPress={() => navigation.popTo('Login')}
          />
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
