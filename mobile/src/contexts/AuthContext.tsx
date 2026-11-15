import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  authService,
} from '../services/auth.service';

import {
  sessionService,
} from '../services/session.service';

import {
  authStorage,
} from '../storage/authStorage';

import {
  localDb,
} from '../storage/localDb';

import axios from 'axios';

import {
  isUnauthorizedError,
} from '../utils/error';

import {
  clearStoredSession,
  getUnauthorizedNotice,
  SESSION_EXPIRED_MESSAGE,
} from './sessionLogic';

import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
} from '../types/auth';

interface AuthContextData {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;

  /* Aviso exibido na tela de login (ex.: sessão expirada). */
  sessionNotice: string | null;

  clearSessionNotice(): void;

  signIn(
    credentials: LoginCredentials,
  ): Promise<LoginResponse>;

  signOut(): Promise<void>;

  refreshUser(): Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext =
  createContext<
    AuthContextData | undefined
  >(undefined);

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthUser | null>(
      null,
    );

  const [
    isLoadingSession,
    setIsLoadingSession,
  ] = useState(true);

  const [
    sessionNotice,
    setSessionNotice,
  ] = useState<string | null>(null);

  const isAuthenticated =
    Boolean(user);

  const userRef =
    useRef<AuthUser | null>(null);

  userRef.current = user;

  const clearSessionNotice =
    useCallback((): void => {
      setSessionNotice(null);
    }, []);

  const clearSession =
    useCallback(
      async (): Promise<void> => {
        try {
          await clearStoredSession([
            () => authStorage.removeToken(),
            () => localDb.remove('session-user'),
          ]);
        } finally {
          setUser(null);
        }
      },
      [],
    );

  const refreshUser =
    useCallback(
      async (): Promise<void> => {
        const token =
          await authStorage.getToken();

        if (!token) {
          setUser(null);
          return;
        }

        try {
          const authenticatedUser =
            await authService.me();

          setUser(
            authenticatedUser,
          );
        } catch {
          await clearSession();

          throw new Error(
            'A sessão não é mais válida.',
          );
        }
      },
      [clearSession],
    );

  const restoreSession =
    useCallback(
      async (): Promise<void> => {
        try {
          const token =
            await authStorage
              .getToken();

          if (!token) {
            setUser(null);
            return;
          }

          const authenticatedUser =
            await authService.me();

          setUser(
            authenticatedUser,
          );

          await localDb.set(
            'session-user',
            authenticatedUser,
          );
        } catch (error: unknown) {
          const cachedUser =
            axios.isAxiosError(error) &&
            !error.response
              ? await localDb.get<AuthUser>(
                  'session-user',
                )
              : null;

          if (cachedUser) {
            setUser(cachedUser);
          } else {
            await clearSession();

            if (isUnauthorizedError(error)) {
              setSessionNotice(
                SESSION_EXPIRED_MESSAGE,
              );
            }
          }
        } finally {
          setIsLoadingSession(
            false,
          );
        }
      },
      [clearSession],
    );

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const unregister =
      sessionService
        .registerUnauthorizedHandler(
          async () => {
            const notice =
              getUnauthorizedNotice(
                userRef.current !== null,
              );

            await clearSession();

            if (notice) {
              setSessionNotice(notice);
            }
          },
        );

    return unregister;
  }, [clearSession]);

  const signIn =
    useCallback(
      async (
        credentials:
          LoginCredentials,
      ): Promise<LoginResponse> => {
        const result =
          await authService.login({
            email:
              credentials.email
                .trim()
                .toLowerCase(),

            password:
              credentials.password,
          });

        try {
          await authStorage
            .saveToken(
              result.token,
            );

          setSessionNotice(null);
          setUser(result.user);

          await localDb.set(
            'session-user',
            result.user,
          );

          return result;
        } catch {
          await authStorage
            .removeToken();

          setUser(null);

          throw new Error(
            'Não foi possível armazenar a sessão.',
          );
        }
      },
      [],
    );

  const signOut =
    useCallback(
      async (): Promise<void> => {
        setSessionNotice(null);
        await clearSession();
      },
      [clearSession],
    );

  const contextValue =
    useMemo<AuthContextData>(
      () => ({
        user,
        isAuthenticated,
        isLoadingSession,
        sessionNotice,
        clearSessionNotice,
        signIn,
        signOut,
        refreshUser,
      }),
      [
        user,
        isAuthenticated,
        isLoadingSession,
        sessionNotice,
        clearSessionNotice,
        signIn,
        signOut,
        refreshUser,
      ],
    );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}