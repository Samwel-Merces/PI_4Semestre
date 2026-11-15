import { useRef } from 'react';

import {
  SafeAreaView,
  View,
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
import LoadingIndicator from '../components/LoadingIndicator';
import ScreenHeader from '../components/ScreenHeader';
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { useServiceForm } from '../hooks/useServiceForm';
import { commonStyles as styles } from '../theme/commonStyles';
import { confirmAction } from '../utils/confirm';
import { focusField } from '../utils/form';
import type { ServiceValues } from '../utils/formRules';
import { limits } from '../utils/validacoes';

import type { AdminStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<
  AdminStackParamList,
  'ServiceForm'
>;

type PriceField = 'priceSmall' | 'priceMedium' | 'priceLarge';

export default function ServiceFormScreen({
  navigation,
  route,
}: Props) {
  const serviceId = route.params?.serviceId;

  const { form, loading, saving, errorMessage, save, remove } =
    useServiceForm(serviceId);

  const { allowLeave } = useDiscardConfirmation(form.isDirty);

  const nameRef = useRef<TextFieldRef>(null);
  const descriptionRef = useRef<TextFieldRef>(null);
  const durationRef = useRef<TextFieldRef>(null);
  const priceSmallRef = useRef<TextFieldRef>(null);
  const priceMediumRef = useRef<TextFieldRef>(null);
  const priceLargeRef = useRef<TextFieldRef>(null);

  const fieldRefs: Record<keyof ServiceValues, typeof nameRef> = {
    name: nameRef,
    description: descriptionRef,
    duration: durationRef,
    priceSmall: priceSmallRef,
    priceMedium: priceMediumRef,
    priceLarge: priceLargeRef,
  };

  async function handleSave(): Promise<void> {
    const outcome = await save();

    if (!outcome.ok) {
      focusField(fieldRefs, outcome.invalidField);
      return;
    }

    allowLeave();
    navigation.goBack();
  }

  async function handleRemove(): Promise<void> {
    const confirmed = await confirmAction({
      title: 'Excluir serviço',
      message: `Deseja excluir ${form.values.name}?`,
      confirmText: 'Excluir',
      destructive: true,
    });

    if (confirmed && (await remove())) {
      allowLeave();
      navigation.goBack();
    }
  }

  const priceFields: Array<{
    field: PriceField;
    label: string;
    next: PriceField | null;
  }> = [
    {
      field: 'priceSmall',
      label: 'Preço porte pequeno (P)',
      next: 'priceMedium',
    },
    {
      field: 'priceMedium',
      label: 'Preço porte médio (M)',
      next: 'priceLarge',
    },
    {
      field: 'priceLarge',
      label: 'Preço porte grande (G)',
      next: null,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={serviceId ? 'Editar serviço' : 'Novo serviço'}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <LoadingIndicator />
        </View>
      ) : (
        <FormScrollView contentContainerStyle={styles.formContent}>
          <AppTextField
            ref={nameRef}
            label="Nome do serviço"
            placeholder="Banho e tosa"
            {...form.fieldProps('name')}
            onChangeText={(value) => form.setValue('name', value)}
            autoCapitalize="sentences"
            maxLength={limits.serviceNameMax}
            editable={!saving}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() =>
              descriptionRef.current?.focus()
            }
          />

          <AppTextField
            ref={descriptionRef}
            label="Descrição"
            placeholder="O que está incluso no serviço"
            helperText={`De ${limits.descriptionMin} a ${limits.serviceDescriptionMax} caracteres.`}
            {...form.fieldProps('description')}
            onChangeText={(value) =>
              form.setValue('description', value)
            }
            autoCapitalize="sentences"
            maxLength={limits.serviceDescriptionMax}
            multiline
            editable={!saving}
          />

          <AppTextField
            ref={durationRef}
            label="Duração em minutos"
            placeholder="60"
            helperText={`Múltiplos de ${limits.durationStep}, de ${limits.durationMin} a ${limits.durationMax} minutos.`}
            {...form.fieldProps('duration')}
            onChangeText={(value) => form.setValue('duration', value)}
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={3}
            editable={!saving}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() =>
              priceSmallRef.current?.focus()
            }
          />

          {priceFields.map(({ field, label, next }) => (
            <AppTextField
              key={field}
              ref={fieldRefs[field]}
              label={label}
              placeholder="50,00"
              {...form.fieldProps(field)}
              onChangeText={(value) => form.setValue(field, value)}
              keyboardType="decimal-pad"
              autoCorrect={false}
              maxLength={15}
              editable={!saving}
              returnKeyType={next ? 'next' : 'done'}
              submitBehavior={next ? 'submit' : 'blurAndSubmit'}
              onSubmitEditing={() => {
                if (next) {
                  fieldRefs[next].current?.focus();
                } else {
                  void handleSave();
                }
              }}
            />
          ))}

          <FeedbackMessage
            kind="error"
            message={errorMessage}
            style={styles.errorText}
          />

          <AppButton
            size="large"
            label="Salvar"
            loading={form.submitting}
            loadingLabel="Salvando..."
            disabled={saving}
            onPress={() => {
              void handleSave();
            }}
          />

          {serviceId ? (
            <AppButton
              variant="danger"
              label="Excluir serviço"
              disabled={saving}
              onPress={() => {
                void handleRemove();
              }}
            />
          ) : null}
        </FormScrollView>
      )}
    </SafeAreaView>
  );
}
