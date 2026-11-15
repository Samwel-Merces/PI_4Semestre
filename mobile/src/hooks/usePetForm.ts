import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { petService } from '../services/pet.service';

import type { PetSize } from '../types/pet';
import type { Species } from '../types/product';

import { getApiErrorMessage } from '../utils/error';
import { runExclusive, type SubmitOutcome } from '../utils/form';

import {
  validatePetForm,
  type PetTextValues,
} from '../utils/formRules';

import {
  formatBirthDate,
  normalizeName,
  normalizeOptionalText,
  parseBirthDate,
  parseWeight,
} from '../utils/validacoes';

import { useFormState } from './useFormState';

export type PetFormValues = PetTextValues & {
  species: Species;
  size: PetSize;
};

const emptyPet: PetFormValues = {
  name: '',
  species: 'CAO',
  breed: '',
  size: 'M',
  birthDate: '',
  weight: '',
  notes: '',
};

export function usePetForm(petId?: string) {
  const form = useFormState<PetFormValues>({
    initialValues: emptyPet,
    validate: validatePetForm,
  });

  const { reset } = form;

  const [loading, setLoading] = useState(Boolean(petId));
  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const removeLock = useRef(false);

  useEffect(() => {
    if (!petId) {
      return;
    }

    petService
      .findById(petId)
      .then((pet) => {
        reset({
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          size: pet.size,
          birthDate: formatBirthDate(pet.birthDate),
          weight:
            pet.weightKg === null
              ? ''
              : String(pet.weightKg).replace('.', ','),
          notes: pet.notes ?? '',
        });
      })
      .catch((error: unknown) => {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível carregar o pet.',
          ),
        );
      })
      .finally(() => setLoading(false));
  }, [petId, reset]);

  async function save(): Promise<
    SubmitOutcome<keyof PetFormValues>
  > {
    const invalidField = form.validateAll();

    const birthDate = parseBirthDate(form.values.birthDate);
    const weightKg = parseWeight(form.values.weight);

    if (
      invalidField ||
      birthDate === undefined ||
      weightKg === undefined
    ) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      const data = {
        name: normalizeName(form.values.name),
        species: form.values.species,
        breed: normalizeOptionalText(form.values.breed),
        size: form.values.size,
        birthDate,
        weightKg,
        notes: normalizeOptionalText(form.values.notes),
      };

      try {
        if (petId) {
          await petService.update(petId, data);
        } else {
          await petService.create(data);
        }

        return { ok: true as const, result: true as const };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            'Não foi possível salvar o pet.',
          );

        setErrorMessage(message);

        return { ok: false as const, invalidField: apiField };
      }
    });

    return outcome ?? { ok: false, invalidField: null };
  }

  async function remove(): Promise<boolean> {
    if (!petId) {
      return false;
    }

    const removed = await runExclusive(removeLock, async () => {
      try {
        setRemoving(true);
        setErrorMessage('');

        await petService.remove(petId);

        return true;
      } catch (error: unknown) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível excluir o pet.',
          ),
        );

        return false;
      } finally {
        setRemoving(false);
      }
    });

    return removed ?? false;
  }

  return {
    form,
    loading,
    saving: form.submitting || removing,
    errorMessage,
    save,
    remove,
  };
}
