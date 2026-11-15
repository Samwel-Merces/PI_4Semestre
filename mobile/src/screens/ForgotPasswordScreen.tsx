import { useRef } from 'react';

import {
  SafeAreaView,
  Text,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AppButton from '../components/AppButton';
import AppTextField, {
  type TextFieldRef,
} from '../components/AppTextField';
import FeedbackMessage from '../components/FeedbackMessage';
import FormScrollView from '../components/FormScrollView';
import ScreenTitle from '../components/ScreenTitle';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { authStyles as styles } from '../theme/authStyles';
import type { AuthStackParamList } from '../types/navigation';
import { limits } from '../utils/validacoes';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'ForgotPassword'
>;

export default function ForgotPasswordScreen({
  navigation,
}: Props) {
  const {
    form,
    loading,
    errorMessage,
    successMessage,
    handleForgotPassword,
  } = useForgotPassword();

  const emailRef = useRef<TextFieldRef>(null);

  async function onForgotPasswordPress() {
    const outcome = await handleForgotPassword();

    if (!outcome.ok) {
      if (outcome.invalidField) {
        emailRef.current?.focus();
      }

      return;
    }

    if (!outcome.result.token) {
      return;
    }

    navigation.navigate('ResetPassword', {
      token: outcome.result.token,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <FormScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logo}>
          PETSHOP
        </Text>

        <ScreenTitle style={styles.title}>
          Recuperar senha
        </ScreenTitle>

        <Text style={styles.subtitle}>
          Informe seu e-mail para receber as
          instruções de recuperação.
        </Text>

        <View style={styles.form}>
          <AppTextField
            ref={emailRef}
            label="E-mail"
            placeholder="nome@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={limits.emailMax}
            {...form.fieldProps('email')}
            onChangeText={(value) => form.setValue('email', value)}
            editable={!loading}
            returnKeyType="send"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => {
              void onForgotPasswordPress();
            }}
          />

          <FeedbackMessage
            kind="error"
            message={errorMessage}
          />

          <FeedbackMessage
            kind="success"
            message={successMessage}
            style={styles.successText}
          />

          <AppButton
            size="large"
            label="Enviar recuperação"
            loading={loading}
            loadingLabel="Enviando..."
            onPress={() => {
              void onForgotPasswordPress();
            }}
            style={{ marginTop: 8 }}
          />

          <AppButton
            variant="link"
            label="Voltar para o login"
            disabled={loading}
            onPress={() => navigation.goBack()}
          />
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
