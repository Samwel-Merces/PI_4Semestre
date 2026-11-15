import { useImperativeHandle, useRef, type Ref } from 'react';

import { StyleSheet, Text, View } from 'react-native';

import { useFormState } from '../hooks/useFormState';
import type { ProductFormValues } from '../hooks/useProductForm';
import { colors } from '../theme/tokens';
import {
  categoryOptions,
  speciesOptions,
} from '../types/product';
import { focusField } from '../utils/form';
import { limits } from '../utils/validacoes';

import AppTextField, { type TextFieldRef } from './AppTextField';
import ChipGroup from './ChipGroup';

type ProductForm = ReturnType<typeof useFormState<ProductFormValues>>;

export interface ProductFormFieldsHandle {
  focus(field: keyof ProductFormValues | null): void;
}

interface ProductFormFieldsProps {
  form: ProductForm;
  disabled: boolean;
  onSubmit: () => void;
  handleRef: Ref<ProductFormFieldsHandle>;
}

/* Campos comuns ao cadastro e à edição de produto. */
export default function ProductFormFields({
  form,
  disabled,
  onSubmit,
  handleRef,
}: ProductFormFieldsProps) {
  const nameRef = useRef<TextFieldRef>(null);
  const descriptionRef = useRef<TextFieldRef>(null);
  const priceRef = useRef<TextFieldRef>(null);
  const stockRef = useRef<TextFieldRef>(null);
  const imageUrlRef = useRef<TextFieldRef>(null);

  useImperativeHandle(handleRef, () => ({
    focus(field) {
      focusField(
        {
          name: nameRef,
          description: descriptionRef,
          price: priceRef,
          stock: stockRef,
          imageUrl: imageUrlRef,
        },
        field,
      );
    },
  }));

  return (
    <View style={styles.fields}>
      <AppTextField
        ref={nameRef}
        label="Nome do produto"
        placeholder="Ração Premium Cães Adultos"
        {...form.fieldProps('name')}
        onChangeText={(value) => form.setValue('name', value)}
        autoCapitalize="sentences"
        autoCorrect
        maxLength={limits.productNameMax}
        editable={!disabled}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => descriptionRef.current?.focus()}
      />

      <AppTextField
        ref={descriptionRef}
        label="Descrição"
        placeholder="Descrição do produto"
        helperText={`De ${limits.descriptionMin} a ${limits.productDescriptionMax} caracteres.`}
        {...form.fieldProps('description')}
        onChangeText={(value) => form.setValue('description', value)}
        autoCapitalize="sentences"
        autoCorrect
        maxLength={limits.productDescriptionMax}
        editable={!disabled}
        multiline
        numberOfLines={4}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <AppTextField
            ref={priceRef}
            label="Preço (R$)"
            placeholder="49,90"
            {...form.fieldProps('price')}
            onChangeText={(value) => form.setValue('price', value)}
            keyboardType="decimal-pad"
            autoCorrect={false}
            maxLength={15}
            editable={!disabled}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => stockRef.current?.focus()}
          />
        </View>

        <View style={styles.half}>
          <AppTextField
            ref={stockRef}
            label="Estoque"
            placeholder="20"
            {...form.fieldProps('stock')}
            onChangeText={(value) => form.setValue('stock', value)}
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={9}
            editable={!disabled}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => imageUrlRef.current?.focus()}
          />
        </View>
      </View>

      <AppTextField
        ref={imageUrlRef}
        label="URL da imagem"
        placeholder="https://images.pexels.com/..."
        helperText="Use o endereço direto da imagem, começando com http:// ou https://."
        {...form.fieldProps('imageUrl')}
        onChangeText={(value) => form.setValue('imageUrl', value)}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="URL"
        maxLength={limits.imageUrlMax}
        editable={!disabled}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onSubmit}
      />

      <View>
        <Text style={styles.label}>Categoria</Text>

        <ChipGroup
          groupLabel="Categoria"
          options={categoryOptions}
          selected={form.values.category}
          onSelect={(value) =>
            value && form.setValue('category', value)
          }
          disabled={disabled}
        />
      </View>

      <View>
        <Text style={styles.label}>Espécie</Text>

        <ChipGroup
          groupLabel="Espécie"
          options={speciesOptions}
          selected={form.values.species}
          onSelect={(value) => form.setValue('species', value)}
          allowClear
          allLabel="Todas"
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    width: '100%',
    gap: 18,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  half: {
    flex: 1,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
});
