/*
 * O expo-secure-store aceita somente letras, números, ".", "-" e "_"
 * nas chaves; "@" ou ":" fazem setItemAsync/getItemAsync lançarem erro.
 */
const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidSecureStoreKey(key: string): boolean {
  return SECURE_STORE_KEY_PATTERN.test(key);
}

export const AUTH_TOKEN_KEY = 'petshop_auth_token';

/*
 * Chave antiga, inválida para o SecureStore. No Android/iOS nunca chegou
 * a ser gravada (a chamada falhava); na web pode existir no sessionStorage
 * e é migrada para a chave nova na primeira leitura.
 */
export const LEGACY_WEB_AUTH_TOKEN_KEY = '@petshop:auth-token';

export const secureStoreKeys = [AUTH_TOKEN_KEY] as const;
