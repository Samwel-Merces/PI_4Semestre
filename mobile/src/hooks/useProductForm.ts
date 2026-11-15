import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  productService,
} from '../services/product.service';

import type {
  ProductCategory,
  Species,
} from '../types/product';

import {
  formatCentsForInput,
  parseCurrencyInputToCents,
} from '../utils/currency';

import {
  getApiErrorMessage,
} from '../utils/error';

import type { SubmitOutcome } from '../utils/form';

import {
  validateProductForm,
  type ProductTextValues,
} from '../utils/formRules';

import {
  normalizeName,
  parseNonNegativeInteger,
} from '../utils/validacoes';

import { useFormState } from './useFormState';

export type ProductFormValues = ProductTextValues & {
  category: ProductCategory;
  species: Species | null;
  active: boolean;
};

const emptyProduct: ProductFormValues = {
  name: '',
  description: '',
  price: '',
  stock: '',
  imageUrl: '',
  category: 'RACAO',
  species: null,
  active: true,
};

/*
 * Formulário de produto usado no cadastro e na edição.
 * Sem productId, começa vazio; com productId, carrega o produto da API.
 */
export function useProductForm(productId?: string) {
  const form = useFormState<ProductFormValues>({
    initialValues: emptyProduct,
    validate: validateProductForm,
  });

  const { reset } = form;

  const [loading, setLoading] =
    useState(Boolean(productId));

  const [loadErrorMessage, setLoadErrorMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  const loadProduct = useCallback(
    async (): Promise<void> => {
      if (!productId) {
        return;
      }

      try {
        setLoading(true);
        setLoadErrorMessage('');

        const product =
          await productService.findByIdForAdmin(
            productId,
          );

        reset({
          name: product.name,
          description: product.description,
          price: formatCentsForInput(product.priceInCents),
          stock: String(product.stock),
          imageUrl: product.imageUrl,
          category: product.category,
          species: product.species,
          active: product.active,
        });
      } catch (error: unknown) {
        setLoadErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível carregar o produto.',
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [productId, reset],
  );

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  async function save(): Promise<
    SubmitOutcome<keyof ProductFormValues>
  > {
    const invalidField = form.validateAll();

    const priceInCents = parseCurrencyInputToCents(
      form.values.price,
    );

    const stock = parseNonNegativeInteger(
      form.values.stock,
    );

    if (
      invalidField ||
      priceInCents === null ||
      stock === null
    ) {
      setErrorMessage('');

      return { ok: false, invalidField };
    }

    const outcome = await form.submit(async () => {
      setErrorMessage('');

      const data = {
        name: normalizeName(form.values.name),
        description: form.values.description.trim(),
        priceInCents,
        stock,
        imageUrl: form.values.imageUrl.trim(),
        category: form.values.category,
        species: form.values.species,
      };

      try {
        if (productId) {
          await productService.update(productId, {
            ...data,
            active: form.values.active,
          });
        } else {
          await productService.create(data);
        }

        return { ok: true as const, result: true as const };
      } catch (error: unknown) {
        const { message, invalidField: apiField } =
          form.applyApiError(
            error,
            productId
              ? 'Não foi possível atualizar o produto.'
              : 'Não foi possível cadastrar o produto.',
          );

        setErrorMessage(message);

        return { ok: false as const, invalidField: apiField };
      }
    });

    return outcome ?? { ok: false, invalidField: null };
  }

  return {
    form,
    loading,
    saving: form.submitting,
    loadErrorMessage,
    errorMessage,
    loadProduct,
    save,
  };
}
