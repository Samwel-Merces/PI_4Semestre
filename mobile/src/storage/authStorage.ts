import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = '@petshop:auth-token';

// Padrão Adapter: interface-alvo que o app usa para guardar o token da
// sessão. Cada plataforma tem o seu adapter.
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

function isWebStorageAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

// Android e iOS: armazenamento seguro do sistema.
class SecureStoreAdapter implements TokenStorage {
  get(): Promise<string | null> {
    return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  }

  set(token: string): Promise<void> {
    return SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  }

  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  }
}

// Navegador: sessionStorage, que some ao fechar a aba.
class WebStorageAdapter implements TokenStorage {
  async get(): Promise<string | null> {
    if (!isWebStorageAvailable()) {
      return null;
    }

    return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  }

  async set(token: string): Promise<void> {
    if (!isWebStorageAvailable()) {
      throw new Error(
        'O armazenamento da sessão não está disponível.'
      );
    }

    window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  async clear(): Promise<void> {
    if (isWebStorageAvailable()) {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }
}

export const tokenStorage: TokenStorage =
  Platform.OS === 'web'
    ? new WebStorageAdapter()
    : new SecureStoreAdapter();

export const authStorage = {
  async saveToken(token: string): Promise<void> {
    if (!token) {
      throw new Error(
        'Não foi possível armazenar um token vazio.'
      );
    }

    await tokenStorage.set(token);
  },

  getToken(): Promise<string | null> {
    return tokenStorage.get();
  },

  removeToken(): Promise<void> {
    return tokenStorage.clear();
  },
};
