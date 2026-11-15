import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from '@react-navigation/native';

import { appointmentService } from '../services/appointment.service';
import { petService } from '../services/pet.service';
import { serviceService } from '../services/service.service';

import type { Pet } from '../types/pet';
import type { Service } from '../types/service';

import { nextDays } from '../utils/date';
import {
  getApiErrorCode,
  getApiErrorMessage,
} from '../utils/error';
import {
  hasErrors,
  runExclusive,
} from '../utils/form';
import {
  validateBookingSelection,
  validationMessages,
  type BookingErrors,
} from '../utils/validacoes';

export const bookingDays = nextDays(14);

export function useBooking(serviceId: string) {
  const [service, setService] = useState<Service | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState<string | null>(null);
  const [date, setDate] = useState(bookingDays[0]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<BookingErrors>({});

  const submitLock = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      Promise.all([
        serviceService.listActive(),
        petService.list(),
      ])
        .then(([services, ownPets]) => {
          setService(
            services.find((item) => item.id === serviceId) ??
              null,
          );

          setPets(ownPets);

          setPetId((current) =>
            ownPets.some((pet) => pet.id === current)
              ? current
              : (ownPets[0]?.id ?? null),
          );
        })
        .catch((error: unknown) => {
          setErrorMessage(
            getApiErrorMessage(
              error,
              'Não foi possível carregar os dados do agendamento.',
            ),
          );
        })
        .finally(() => setLoading(false));
    }, [serviceId]),
  );

  const loadSlots = useCallback(async (): Promise<void> => {
    try {
      setLoadingSlots(true);
      setSlot(null);
      setSlots(
        await appointmentService.availability(serviceId, date),
      );
    } catch (error: unknown) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          'Não foi possível carregar os horários.',
        ),
      );
    } finally {
      setLoadingSlots(false);
    }
  }, [serviceId, date]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  /* Ao trocar uma escolha, o erro daquele grupo deixa de valer. */
  const selectPet = useCallback((value: string | null): void => {
    setPetId(value);
    setFieldErrors(({ petId: _removed, ...rest }) => rest);
  }, []);

  const selectDate = useCallback((value: string): void => {
    setDate(value);
    setFieldErrors(({ date: _removed, ...rest }) => rest);
  }, []);

  const selectSlot = useCallback((value: string | null): void => {
    setSlot(value);
    setFieldErrors(({ slot: _removed, ...rest }) => rest);
  }, []);

  async function submit(): Promise<boolean> {
    const errors = validateBookingSelection({
      petId,
      date,
      slot,
      availableSlots: slots,
    });

    setFieldErrors(errors);

    if (hasErrors(errors) || !petId || !slot) {
      setErrorMessage('');

      return false;
    }

    const created = await runExclusive(submitLock, async () => {
      try {
        setSubmitting(true);
        setErrorMessage('');

        await appointmentService.create({
          petId,
          serviceId,
          scheduledAt: slot,
        });

        return true;
      } catch (error: unknown) {
        if (getApiErrorCode(error) === 'SLOT_UNAVAILABLE') {
          setFieldErrors({
            slot: validationMessages.slotUnavailable,
          });
        }

        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível concluir o agendamento.',
          ),
        );

        void loadSlots();

        return false;
      } finally {
        setSubmitting(false);
      }
    });

    return created ?? false;
  }

  return {
    service,
    pets,
    petId,
    date,
    slots,
    slot,
    loading,
    loadingSlots,
    submitting,
    errorMessage,
    fieldErrors,
    setPetId: selectPet,
    setDate: selectDate,
    setSlot: selectSlot,
    submit,
  };
}
