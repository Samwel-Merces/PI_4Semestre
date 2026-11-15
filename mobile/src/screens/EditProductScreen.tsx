import { useRef } from 'react';

import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';
import FeedbackMessage from '../components/FeedbackMessage';
import FormScrollView from '../components/FormScrollView';
import LoadingIndicator from '../components/LoadingIndicator';
import ProductFormFields, {
  type ProductFormFieldsHandle,
} from '../components/ProductFormFields';
import ScreenTitle from '../components/ScreenTitle';
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { useProductForm } from '../hooks/useProductForm';
import { sizes } from '../theme/tokens';

import type {
  AdminStackParamList,
} from '../types/navigation';

type Props = NativeStackScreenProps<
  AdminStackParamList,
  'EditProduct'
>;

export default function EditProductScreen({
  navigation,
  route,
}: Props) {
  const { productId } = route.params;

  const {
    form,
    loading,
    saving,
    loadErrorMessage,
    errorMessage,
    loadProduct,
    save,
  } = useProductForm(productId);

  const { allowLeave } = useDiscardConfirmation(form.isDirty);

  const fieldsRef = useRef<ProductFormFieldsHandle>(null);

  const active = form.values.active;

  async function handleSave(): Promise<void> {
    const outcome = await save();

    if (!outcome.ok) {
      fieldsRef.current?.focus(outcome.invalidField);
      return;
    }

    allowLeave();
    navigation.goBack();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContent}>
          <LoadingIndicator message="Carregando produto..." />
        </View>
      </SafeAreaView>
    );
  }

  if (loadErrorMessage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContent}>
          <FeedbackMessage
            kind="error"
            message={loadErrorMessage}
            style={styles.errorText}
          />

          <AppButton
            label="Tentar novamente"
            onPress={() => {
              void loadProduct();
            }}
          />

          <AppButton
            variant="outline"
            label="Voltar"
            style={{ marginTop: 8 }}
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FormScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />

        <ScreenTitle style={styles.title}>
          Editar produto
        </ScreenTitle>

        <Text style={styles.subtitle}>
          Atualize as informações do produto selecionado.
        </Text>

        <ProductFormFields
          form={form}
          disabled={saving}
          handleRef={fieldsRef}
          onSubmit={() => {
            void handleSave();
          }}
        />

        <View style={styles.statusCard}>
          <View style={styles.statusInformation}>
            <Text style={styles.statusTitle}>
              Produto ativo
            </Text>

            <Text style={styles.statusDescription}>
              Produtos inativos não aparecem no catálogo do cliente.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.statusToggle,
              active
                ? styles.statusToggleActive
                : styles.statusToggleInactive,
            ]}
            activeOpacity={0.8}
            disabled={saving}
            onPress={() => form.setValue('active', !active)}
            accessibilityRole="switch"
            accessibilityLabel={`Situação do produto: ${
              active ? 'Ativo' : 'Inativo'
            }`}
            accessibilityState={{
              checked: active,
              disabled: saving,
            }}
          >
            <Text style={styles.statusToggleText}>
              {active ? 'Ativo' : 'Inativo'}
            </Text>
          </TouchableOpacity>
        </View>

        <FeedbackMessage
          kind="error"
          message={errorMessage}
          style={styles.formErrorText}
        />

        <AppButton
          size="large"
          label="Salvar alterações"
          loading={saving}
          loadingLabel="Salvando..."
          style={styles.saveButton}
          onPress={() => {
            void handleSave();
          }}
        />

        <AppButton
          variant="link"
          label="Cancelar"
          disabled={saving}
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        />
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    width: '100%',
    maxWidth: 650,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: '#1E293B',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 26,
  },
  statusCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  statusInformation: {
    flex: 1,
    paddingRight: 14,
  },
  statusTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '700',
  },
  statusDescription: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  statusToggle: {
    minWidth: 82,
    minHeight: sizes.minTouch,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleActive: {
    backgroundColor: '#15803D',
  },
  statusToggleInactive: {
    backgroundColor: '#DC2626',
  },
  statusToggleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  formErrorText: {
    marginBottom: 16,
  },
  saveButton: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
    marginTop: 8,
  },
  centeredContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 20,
  },
});
