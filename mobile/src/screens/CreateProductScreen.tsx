import { useRef } from 'react';

import {
  SafeAreaView,
  Text,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';
import FeedbackMessage from '../components/FeedbackMessage';
import FormScrollView from '../components/FormScrollView';
import ProductFormFields, {
  type ProductFormFieldsHandle,
} from '../components/ProductFormFields';
import ScreenTitle from '../components/ScreenTitle';
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { useProductForm } from '../hooks/useProductForm';
import { authStyles as styles } from '../theme/authStyles';

import type { AdminStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<
  AdminStackParamList,
  'CreateProduct'
>;

export default function CreateProductScreen({
  navigation,
}: Props) {
  const {
    form,
    saving,
    errorMessage,
    save,
  } = useProductForm();

  const { allowLeave } = useDiscardConfirmation(form.isDirty);

  const fieldsRef = useRef<ProductFormFieldsHandle>(null);

  async function onCreateProductPress() {
    const outcome = await save();

    if (!outcome.ok) {
      fieldsRef.current?.focus(outcome.invalidField);
      return;
    }

    allowLeave();
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      <FormScrollView contentContainerStyle={styles.createProductContent}>
        <BackButton onPress={() => navigation.goBack()} />

        <View style={styles.createProductHeader}>
          <ScreenTitle style={styles.createProductTitle}>
            Cadastrar produto
          </ScreenTitle>

          <Text
            style={styles.createProductSubtitle}
          >
            Preencha os dados para adicionar um
            produto ao catálogo.
          </Text>
        </View>

        <View style={styles.createProductForm}>
          <ProductFormFields
            form={form}
            disabled={saving}
            handleRef={fieldsRef}
            onSubmit={() => {
              void onCreateProductPress();
            }}
          />

          <FeedbackMessage
            kind="error"
            message={errorMessage}
            style={styles.createProductErrorText}
          />

          <AppButton
            size="large"
            label="Cadastrar produto"
            loading={saving}
            loadingLabel="Cadastrando..."
            style={styles.createProductSubmitButton}
            onPress={() => {
              void onCreateProductPress();
            }}
          />

          <AppButton
            variant="link"
            label="Cancelar"
            disabled={saving}
            style={styles.createProductCancelButton}
            onPress={() => navigation.goBack()}
          />
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
