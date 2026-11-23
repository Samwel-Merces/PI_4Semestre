import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  orderService,
} from '../services/order.service';

import {
  paymentService,
} from '../services/payment.service';

import type {
  Order,
} from '../types/order';

import {
  getApiErrorMessage,
} from '../utils/error';

import {
  openPaymentPage,
} from '../utils/openPaymentPage';

interface UseOrderDetailsProps {
  orderId: string;
}

export function useOrderDetails({
  orderId,
}: UseOrderDetailsProps) {
  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    checkingPayment,
    setCheckingPayment,
  ] = useState(false);

  const [
    paymentMessage,
    setPaymentMessage,
  ] = useState('');

  const [
    resumingPayment,
    setResumingPayment,
  ] = useState(false);

  const loadOrder = useCallback(
    async (
      options?: {
        refreshing?: boolean;
      },
    ): Promise<void> => {
      const isRefreshing =
        options?.refreshing === true;

      try {
        if (isRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        let result =
          await orderService.findById(
            orderId,
          );

        // Ao voltar do Mercado Pago o webhook pode ainda não ter chegado.
        // Confere o pagamento direto; se falhar, mostra o pedido como está.
        if (
          result.status ===
          'PENDING_PAYMENT'
        ) {
          try {
            result =
              await paymentService.syncOrderPayment(
                orderId,
              );
          } catch {
            // O botão "Verificar pagamento" permite tentar de novo.
          }
        }

        setOrder(result);
      } catch (error: unknown) {
        setOrder(null);

        setErrorMessage(
          getApiErrorMessage(
            error,
            'Não foi possível carregar o pedido.',
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  const refreshOrder =
    useCallback(
      async (): Promise<void> => {
        await loadOrder({
          refreshing: true,
        });
      },
      [loadOrder],
    );

  const checkPayment =
    useCallback(
      async (): Promise<void> => {
        try {
          setCheckingPayment(true);
          setPaymentMessage('');

          const result =
            await paymentService.syncOrderPayment(
              orderId,
            );

          setOrder(result);

          if (
            result.status ===
            'PENDING_PAYMENT'
          ) {
            setPaymentMessage(
              'O pagamento ainda não foi confirmado pelo Mercado Pago.',
            );
          }
        } catch (error: unknown) {
          setPaymentMessage(
            getApiErrorMessage(
              error,
              'Não foi possível verificar o pagamento.',
            ),
          );
        } finally {
          setCheckingPayment(false);
        }
      },
      [orderId],
    );

  const resumePayment =
    useCallback(
      async (): Promise<void> => {
        try {
          setResumingPayment(true);
          setPaymentMessage('');

          const { initPoint } =
            await paymentService.resumeOrderPayment(
              orderId,
            );

          await openPaymentPage(initPoint);

          // De volta do Mercado Pago: recarregar já confere o pagamento.
          await loadOrder({
            refreshing: true,
          });
        } catch (error: unknown) {
          setPaymentMessage(
            getApiErrorMessage(
              error,
              'Não foi possível abrir o pagamento.',
            ),
          );
        } finally {
          setResumingPayment(false);
        }
      },
      [loadOrder, orderId],
    );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  return {
    order,
    loading,
    refreshing,
    errorMessage,
    checkingPayment,
    resumingPayment,
    paymentMessage,
    loadOrder,
    refreshOrder,
    checkPayment,
    resumePayment,
  };
}