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
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { useRegister } from '../hooks/useRegister';
import { authStyles as styles } from '../theme/authStyles';
import type { AuthStackParamList } from '../types/navigation';
import { focusField } from '../utils/form';
import {
  formatPhone,
  limits,
} from '../utils/validacoes';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'Register'
>;

export default function RegisterScreen({
  navigation,
}: Props) {
  const {
    form,
    loading,
    errorMessage,
    handleRegister,
  } = useRegister();

  const { allowLeave } = useDiscardConfirmation(form.isDirty);

  const nameRef = useRef<TextFieldRef>(null);
  const emailRef = useRef<TextFieldRef>(null);
  const phoneRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);
  const confirmationRef = useRef<TextFieldRef>(null);

  async function onRegisterPress() {
    const outcome = await handleRegister();

    if (!outcome.ok) {
      focusField(
        {
          name: nameRef,
          email: emailRef,
          phone: phoneRef,
          password: passwordRef,
          passwordConfirmation: confirmationRef,
        },
        outcome.invalidField,
      );

      return;
    }

    /*
     * Volta para o login já existente na pilha (sem empilhar outro),
     * com o e-mail preenchido e a mensagem de sucesso.
     */
    allowLeave();

    navigation.popTo('Login', {
      email: outcome.result,
      successMessage:
        'Cadastro realizado com sucesso. Entre com sua senha.',
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <FormScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logo}>PETSHOP</Text>

        <ScreenTitle style={styles.title}>Criar conta</ScreenTitle>

        <Text style={styles.subtitle}>
          Preencha os dados para continuar.
        </Text>

        <View style={styles.form}>
          <AppTextField
            ref={nameRef}
            label="Nome completo"
            placeholder="Maria da Silva"
            {...form.fieldProps('name')}
            onChangeText={(value) => form.setValue('name', value)}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="name"
            textContentType="name"
            maxLength={limits.userNameMax}
            editable={!loading}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

          <AppTextField
            ref={emailRef}
            label="E-mail"
            placeholder="nome@exemplo.com"
            {...form.fieldProps('email')}
            onChangeText={(value) => form.setValue('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={limits.emailMax}
            editable={!loading}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />

          <AppTextField
            ref={phoneRef}
            label="Telefone"
            placeholder="(11) 91234-5678"
            helperText="Com DDD."
            {...form.fieldProps('phone')}
            onChangeText={(value) =>
              form.setValue('phone', formatPhone(value))
            }
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={limits.phoneInputMax}
            editable={!loading}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <PasswordInput
            ref={passwordRef}
            label="Senha"
            placeholder="Digite sua senha"
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
            label="Confirmar senha"
            placeholder="Repita a senha"
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
              void onRegisterPress();
            }}
          />

          <FeedbackMessage
            kind="error"
            message={errorMessage}
          />

          <AppButton
            size="large"
            label="Cadastrar"
            loading={loading}
            loadingLabel="Cadastrando..."
            onPress={() => {
              void onRegisterPress();
            }}
            style={{ marginTop: 8 }}
          />

          <AppButton
            variant="link"
            label="Já possui uma conta? Entrar"
            disabled={loading}
            onPress={() => navigation.goBack()}
          />
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
