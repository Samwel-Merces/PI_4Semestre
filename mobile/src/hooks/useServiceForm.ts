import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { serviceService } from '../services/service.service';

import {
  formatCentsForInput,
  parseCurrencyInputToCents,
} from '../utils/currency';

import { getApiErrorMessage } from '../utils/error';
import { runExclusive, type SubmitOutcome } from '../utils/form';

import {
  validateServiceForm,
  type ServiceValues,
} from '../utils/formRules';

import {
  normalizeName,
  parseNonNegativeInteger,
} from '../utils/validacoes';

import { useFormState } from './useFormState';

const emptyService: ServiceValues = {
  name: '',
  description: '',
  duration: '60',
  priceSmall: '',
  priceMedium: '',
  priceLarge: '',
};

export function useServiceForm(serviceId?: string) {
  const form = useFormState<ServiceValues>({
    initialValues: emptyService,
    validate: validateServiceForm,
  });

  const { reset } = form;

  const [loading, setLoading] = useState(Boolean(serviceId));
  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const removeLock = useRef(false);

  useEffect(() => {
    if (!serviceId) {
      return;
    }

    serviceService
      .findByIdForAdmin(serviceId)
      .then((service) => {
        reset({
          name: service.name,
          description: service.description,
          duration: String(service.durationMinutes),
          priceSmall: formatCentsForInput(service.priceSmallInCents),
          priceMedium: formatCentsForInput(service.priceMediumInCents),
          priceLarge: formatCentsForInput(service.priceLargeInCents),
        });
      })
      .catch((error: unknown) => {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível carregar o serviço.',
          ),
        );
      })
      .finally(() => setLoading(false));
  }, [serviceId, reset]);

  async function save(): Promise<
    SubmitOutcome<keyof ServiceValues>
  > {
    const invalidField = form.validateAll();

    const durationMinutes = parseNonNegativeInteger(
      form.values.duration,
    );
    const priceSmallInCents = parseCurrencyInputToCents(
      form.values.priceSmall,
    );
    const priceMediumInCents = parseCurrencyInputToCents(
      form.values.priceMedium,
    );
    const priceLargeInCents = parseCurrencyInputToCents(
      form.values.priceLarge,
    );

    if (
      invalidField ||
      durationMinutes === null ||
      priceSmallInCents === null ||
      priceMediumInCents === null ||
      priceLargeInCents === null
    ) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      const data = {
        name: normalizeName(form.values.name),
        description: form.values.description.trim(),
        durationMinutes,
        priceSmallInCents,
        priceMediumInCents,
        priceLargeInCents,
      };

      try {
        if (serviceId) {
          await serviceService.update(serviceId, data);
        } else {
          await serviceService.create(data);
        }

        return { ok: true as const, result: true as const };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            'Não foi possível salvar o serviço.',
          );

        setErrorMessage(message);

        return { ok: false as const, invalidField: apiField };
      }
    });

    return outcome ?? { ok: false, invalidField: null };
  }

  async function remove(): Promise<boolean> {
    if (!serviceId) {
      return false;
    }

    const removed = await runExclusive(removeLock, async () => {
      try {
        setRemoving(true);
        setErrorMessage('');

        await serviceService.remove(serviceId);

        return true;
      } catch (error: unknown) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível excluir o serviço.',
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
