import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  AUTH_TOKEN_KEY,
  LEGACY_WEB_AUTH_TOKEN_KEY,
} from './storageKeys';

function isWebStorageAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

function readWebToken(): string | null {
  const token = window.sessionStorage.getItem(
    AUTH_TOKEN_KEY
  );

  if (token) {
    return token;
  }

  const legacyToken = window.sessionStorage.getItem(
    LEGACY_WEB_AUTH_TOKEN_KEY
  );

  if (!legacyToken) {
    return null;
  }

  window.sessionStorage.setItem(
    AUTH_TOKEN_KEY,
    legacyToken
  );

  window.sessionStorage.removeItem(
    LEGACY_WEB_AUTH_TOKEN_KEY
  );

  return legacyToken;
}

export const authStorage = {
  async saveToken(token: string): Promise<void> {
    if (!token) {
      throw new Error(
        'Não foi possível armazenar um token vazio.'
      );
    }

    if (Platform.OS === 'web') {
      if (!isWebStorageAvailable()) {
        throw new Error(
          'O armazenamento da sessão não está disponível.'
        );
      }

      window.sessionStorage.setItem(
        AUTH_TOKEN_KEY,
        token
      );

      return;
    }

    await SecureStore.setItemAsync(
      AUTH_TOKEN_KEY,
      token
    );
  },

  async getToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (!isWebStorageAvailable()) {
        return null;
      }

      return readWebToken();
    }

    return SecureStore.getItemAsync(
      AUTH_TOKEN_KEY
    );
  },

  async removeToken(): Promise<void> {
    if (Platform.OS === 'web') {
      if (isWebStorageAvailable()) {
        window.sessionStorage.removeItem(
          AUTH_TOKEN_KEY
        );

        window.sessionStorage.removeItem(
          LEGACY_WEB_AUTH_TOKEN_KEY
        );
      }

      return;
    }

    await SecureStore.deleteItemAsync(
      AUTH_TOKEN_KEY
    );
  },
};
