import {
  Platform,
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';

import {
  MERCADOPAGO_RETURN_URL,
} from '../config/payment';

// Abre a página de pagamento do Mercado Pago. No celular, a sessão fecha
// sozinha quando o Mercado Pago redireciona para o deep link de retorno.
export async function openPaymentPage(
  initPoint: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync(
      initPoint,
    );

    return;
  }

  await WebBrowser.openAuthSessionAsync(
    initPoint,
    MERCADOPAGO_RETURN_URL,
  );
}
