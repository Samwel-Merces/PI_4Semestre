import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  cartService,
} from '../services/cart.service';

import {
  getApiErrorMessage,
} from '../utils/error';

import {
  limits,
  validateQuantity,
} from '../utils/validacoes';

interface UseAddToCartProps {
  productId: string;
  maximumQuantity: number;
}

export function useAddToCart({
  productId,
  maximumQuantity,
}: UseAddToCartProps) {
  const [quantity, setQuantity] =
    useState(1);

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  /* Impede que dois toques rápidos adicionem o item duas vezes. */
  const submitLock = useRef(false);

  useEffect(() => {
    setQuantity((currentQuantity) => {
      const maximumAllowed =
        Math.min(
          maximumQuantity,
          limits.cartQuantityMax,
        );

      if (maximumAllowed < 1) {
        return 1;
      }

      return Math.min(
        currentQuantity,
        maximumAllowed,
      );
    });
  }, [maximumQuantity]);

  const incrementQuantity =
    useCallback((): void => {
      setErrorMessage('');
      setSuccessMessage('');

      setQuantity(
        (currentQuantity) =>
          Math.min(
            currentQuantity + 1,
            maximumQuantity,
            limits.cartQuantityMax,
          ),
      );
    }, [maximumQuantity]);

  const decrementQuantity =
    useCallback((): void => {
      setErrorMessage('');
      setSuccessMessage('');

      setQuantity(
        (currentQuantity) =>
          Math.max(
            currentQuantity - 1,
            1,
          ),
      );
    }, []);

  const addToCart = useCallback(
    async (): Promise<boolean> => {
      if (submitLock.current) {
        return false;
      }

      setErrorMessage('');
      setSuccessMessage('');

      const quantityError = validateQuantity(
        quantity,
        maximumQuantity,
      );

      if (quantityError) {
        setErrorMessage(quantityError);

        return false;
      }

      try {
        submitLock.current = true;
        setLoading(true);

        await cartService.addItem({
          productId,
          quantity,
        });

        setSuccessMessage(
          'Produto adicionado ao carrinho.',
        );

        return true;
      } catch (error: unknown) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível adicionar o produto ao carrinho.',
          ),
        );

        return false;
      } finally {
        submitLock.current = false;
        setLoading(false);
      }
    },
    [
      maximumQuantity,
      productId,
      quantity,
    ],
  );

  return {
    quantity,
    loading,
    errorMessage,
    successMessage,
    incrementQuantity,
    decrementQuantity,
    addToCart,
  };
}