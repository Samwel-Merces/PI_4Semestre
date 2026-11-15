import { useRef } from 'react';

import {
  SafeAreaView,
  Text,
  View,
} from 'react-native';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import AppButton from '../components/AppButton';
import AppTextField, {
  type TextFieldRef,
} from '../components/AppTextField';
import ChipGroup from '../components/ChipGroup';
import FeedbackMessage from '../components/FeedbackMessage';
import FormScrollView from '../components/FormScrollView';
import LoadingIndicator from '../components/LoadingIndicator';
import ScreenHeader from '../components/ScreenHeader';
import { useDiscardConfirmation } from '../hooks/useDiscardConfirmation';
import { usePetForm } from '../hooks/usePetForm';
import { commonStyles as styles } from '../theme/commonStyles';
import { confirmAction } from '../utils/confirm';
import { focusField } from '../utils/form';
import {
  formatDateInput,
  limits,
} from '../utils/validacoes';

import type { ClientStackParamList } from '../types/navigation';
import { sizeOptions } from '../types/pet';
import { speciesOptions } from '../types/product';

type Props = NativeStackScreenProps<
  ClientStackParamList,
  'PetForm'
>;

export default function PetFormScreen({
  navigation,
  route,
}: Props) {
  const petId = route.params?.petId;

  const { form, loading, saving, errorMessage, save, remove } =
    usePetForm(petId);

  const { allowLeave } = useDiscardConfirmation(form.isDirty);

  const nameRef = useRef<TextFieldRef>(null);
  const breedRef = useRef<TextFieldRef>(null);
  const birthDateRef = useRef<TextFieldRef>(null);
  const weightRef = useRef<TextFieldRef>(null);
  const notesRef = useRef<TextFieldRef>(null);

  async function handleSave(): Promise<void> {
    const outcome = await save();

    if (!outcome.ok) {
      focusField(
        {
          name: nameRef,
          breed: breedRef,
          birthDate: birthDateRef,
          weight: weightRef,
          notes: notesRef,
        },
        outcome.invalidField,
      );

      return;
    }

    allowLeave();
    navigation.goBack();
  }

  async function handleRemove(): Promise<void> {
    const confirmed = await confirmAction({
      title: 'Excluir pet',
      message: `Deseja excluir ${form.values.name}?`,
      confirmText: 'Excluir',
      destructive: true,
    });

    if (confirmed && (await remove())) {
      allowLeave();
      navigation.goBack();
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={petId ? 'Editar pet' : 'Novo pet'}
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
            label="Nome"
            placeholder="Nome do pet"
            {...form.fieldProps('name')}
            onChangeText={(value) => form.setValue('name', value)}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={limits.petNameMax}
            editable={!saving}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => breedRef.current?.focus()}
          />

          <View>
            <Text style={styles.label}>Espécie</Text>

            <ChipGroup
              groupLabel="Espécie"
              options={speciesOptions}
              selected={form.values.species}
              onSelect={(value) =>
                value && form.setValue('species', value)
              }
              disabled={saving}
            />
          </View>

          <View>
            <Text style={styles.label}>Porte</Text>

            <ChipGroup
              groupLabel="Porte"
              options={sizeOptions}
              selected={form.values.size}
              onSelect={(value) =>
                value && form.setValue('size', value)
              }
              disabled={saving}
            />
          </View>

          <AppTextField
            ref={breedRef}
            label="Raça (opcional)"
            placeholder="Ex.: Labrador"
            {...form.fieldProps('breed')}
            onChangeText={(value) => form.setValue('breed', value)}
            autoCapitalize="words"
            maxLength={limits.breedMax}
            editable={!saving}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => birthDateRef.current?.focus()}
          />

          <AppTextField
            ref={birthDateRef}
            label="Data de nascimento (opcional)"
            placeholder="DD/MM/AAAA"
            helperText="Dia, mês e ano."
            {...form.fieldProps('birthDate')}
            onChangeText={(value) =>
              form.setValue('birthDate', formatDateInput(value))
            }
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={10}
            editable={!saving}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => weightRef.current?.focus()}
          />

          <AppTextField
            ref={weightRef}
            label="Peso em kg (opcional)"
            placeholder="8,5"
            {...form.fieldProps('weight')}
            onChangeText={(value) => form.setValue('weight', value)}
            keyboardType="decimal-pad"
            autoCorrect={false}
            maxLength={6}
            editable={!saving}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => notesRef.current?.focus()}
          />

          <AppTextField
            ref={notesRef}
            label="Observações (opcional)"
            placeholder="Alergias, cuidados especiais..."
            {...form.fieldProps('notes')}
            onChangeText={(value) => form.setValue('notes', value)}
            autoCapitalize="sentences"
            maxLength={limits.notesMax}
            multiline
            editable={!saving}
          />

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

          {petId ? (
            <AppButton
              variant="danger"
              label="Excluir pet"
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
