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
import PasswordInput from '../components/PasswordInput';
import ScreenTitle from '../components/ScreenTitle';
import { useAuth } from '../hooks/useAuth';
import { useLogin } from '../hooks/useLogin';
import { authStyles as styles } from '../theme/authStyles';
import type { AuthStackParamList } from '../types/navigation';
import { focusField } from '../utils/form';
import { limits } from '../utils/validacoes';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'Login'
>;

export default function LoginScreen({
  navigation,
  route,
}: Props) {
  const { sessionNotice } = useAuth();

  const {
    form,
    loading,
    errorMessage,
    handleLogin,
  } = useLogin(route.params?.email);

  const successMessage = route.params?.successMessage ?? '';

  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);

  async function onLoginPress() {
    if (successMessage) {
      navigation.setParams({ successMessage: undefined });
    }

    const outcome = await handleLogin();

    if (!outcome.ok) {
      focusField(
        { email: emailRef, password: passwordRef },
        outcome.invalidField,
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <FormScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logo}>
          PETSHOP
        </Text>

        <ScreenTitle style={styles.title}>
          Bem-vindo
        </ScreenTitle>

        <Text style={styles.subtitle}>
          Entre com suas credenciais para continuar.
        </Text>

        <View style={styles.form}>
          {sessionNotice ? (
            <FeedbackMessage
              kind="info"
              message={sessionNotice}
              style={styles.successText}
            />
          ) : null}

          <FeedbackMessage
            kind="success"
            message={successMessage}
            style={styles.successText}
          />

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
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <PasswordInput
            ref={passwordRef}
            label="Senha"
            placeholder="Digite sua senha"
            autoComplete="current-password"
            textContentType="password"
            {...form.fieldProps('password')}
            onChangeText={(value) => form.setValue('password', value)}
            editable={!loading}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => {
              void onLoginPress();
            }}
          />

          <FeedbackMessage
            kind="error"
            message={errorMessage}
          />

          <AppButton
            size="large"
            label="Entrar"
            loading={loading}
            loadingLabel="Entrando..."
            onPress={() => {
              void onLoginPress();
            }}
            style={{ marginTop: 8 }}
          />

          <AppButton
            variant="link"
            label="Esqueci minha senha"
            disabled={loading}
            onPress={() => navigation.navigate('ForgotPassword')}
          />

          <AppButton
            variant="link"
            label="Criar conta"
            disabled={loading}
            onPress={() => navigation.navigate('Register')}
          />
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
