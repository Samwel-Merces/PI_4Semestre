import axios from 'axios';

import type {
  ApiErrorBody,
  LegacyApiErrorBody,
} from '../types/api';

function isApiErrorBody(
  value: unknown,
): value is ApiErrorBody {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('error' in value)
  ) {
    return false;
  }

  const errorValue = (
    value as {
      error?: unknown;
    }
  ).error;

  return (
    typeof errorValue === 'object' &&
    errorValue !== null &&
    'message' in errorValue &&
    typeof (
      errorValue as {
        message?: unknown;
      }
    ).message === 'string'
  );
}

function isLegacyApiErrorBody(
  value: unknown,
): value is LegacyApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (
      value as {
        message?: unknown;
      }
    ).message === 'string'
  );
}

export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'invalidCredentials'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'rateLimit'
  | 'server'
  | 'timeout'
  | 'network'
  | 'unknown';

export const apiErrorMessages = {
  validation: 'Verifique os dados informados.',
  unauthorized:
    'Sua sessão expirou ou não é mais válida. Entre novamente.',
  forbidden:
    'Você não possui permissão para realizar esta ação.',
  notFound: 'O recurso solicitado não foi encontrado.',
  conflict:
    'A operação não pôde ser concluída devido a um conflito.',
  rateLimit:
    'Muitas solicitações foram realizadas. ' +
    'Aguarde alguns minutos e tente novamente.',
  server:
    'O servidor encontrou um problema. ' +
    'Tente novamente em alguns instantes.',
  timeout:
    'A solicitação demorou mais que o esperado. ' +
    'Verifique sua conexão e tente novamente.',
  network:
    'Não foi possível conectar ao servidor. ' +
    'Verifique sua internet e o endereço da API.',
} as const;

/* Código devolvido pelo backend quando e-mail ou senha estão incorretos. */
const INVALID_CREDENTIALS_CODE = 'INVALID_CREDENTIALS';

function getResponseMessage(
  data: unknown,
): string | null {
  if (isApiErrorBody(data)) {
    return data.error.message;
  }

  if (
    isLegacyApiErrorBody(data) &&
    data.message
  ) {
    return data.message;
  }

  return null;
}

export function getApiErrorKind(
  error: unknown,
): ApiErrorKind {
  if (!axios.isAxiosError(error)) {
    return 'unknown';
  }

  if (!error.response) {
    return error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT'
      ? 'timeout'
      : 'network';
  }

  const status = error.response.status;

  if (status === 400 || status === 422) {
    return 'validation';
  }

  if (status === 401) {
    return getApiErrorCode(error) ===
      INVALID_CREDENTIALS_CODE
      ? 'invalidCredentials'
      : 'unauthorized';
  }

  if (status === 403) {
    return 'forbidden';
  }

  if (status === 404) {
    return 'notFound';
  }

  if (status === 409) {
    return 'conflict';
  }

  if (status === 429) {
    return 'rateLimit';
  }

  if (status >= 500) {
    return 'server';
  }

  return 'unknown';
}

/*
 * Mensagem amigável para exibir em FeedbackMessage.
 * - 400/422, 403, 404, 409 e 401 de login: usa a mensagem do backend,
 *   que é específica (ex.: "E-mail já cadastrado.", "Horário indisponível.").
 * - 401 de sessão: sempre a mensagem de sessão expirada.
 * - 5xx: mensagem genérica, sem expor detalhes internos.
 * - Sem resposta: falha de conexão ou tempo esgotado.
 */
export function getApiErrorMessage(
  error: unknown,
  fallbackMessage:
    string = 'Ocorreu um erro inesperado.',
): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) {
      return error.message;
    }

    return fallbackMessage;
  }

  const kind = getApiErrorKind(error);

  switch (kind) {
    case 'network':
    case 'timeout':
    case 'server':
    case 'unauthorized':
    case 'rateLimit':
      return apiErrorMessages[kind];

    case 'unknown':
      return (
        getResponseMessage(error.response?.data) ??
        fallbackMessage
      );

    case 'invalidCredentials':
      return (
        getResponseMessage(error.response?.data) ??
        'E-mail ou senha inválidos.'
      );

    default:
      return (
        getResponseMessage(error.response?.data) ??
        apiErrorMessages[kind]
      );
  }
}

/*
 * Converte os detalhes de validação do Zod (error.details[].path/message)
 * em erros por campo. Só considera campos conhecidos pelo formulário.
 */
export function getApiFieldErrors<Field extends string>(
  error: unknown,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const result: Partial<Record<Field, string>> = {};

  if (!axios.isAxiosError(error)) {
    return result;
  }

  const data: unknown = error.response?.data;

  if (
    !isApiErrorBody(data) ||
    !Array.isArray(data.error.details)
  ) {
    return result;
  }

  for (const detail of data.error.details as unknown[]) {
    if (typeof detail !== 'object' || detail === null) {
      continue;
    }

    const { path, message } = detail as {
      path?: unknown;
      message?: unknown;
    };

    const field =
      Array.isArray(path) ? path[0] : undefined;

    const knownField = fields.find(
      (item) => item === field,
    );

    if (
      knownField &&
      typeof message === 'string' &&
      result[knownField] === undefined
    ) {
      result[knownField] = message;
    }
  }

  return result;
}

export function getApiErrorCode(
  error: unknown,
): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const responseData: unknown =
    error.response?.data;

  if (!isApiErrorBody(responseData)) {
    return null;
  }

  return responseData.error.code;
}

export function isUnauthorizedError(
  error: unknown,
): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 401
  );
}

export function isNetworkError(
  error: unknown,
): boolean {
  return (
    axios.isAxiosError(error) &&
    !error.response
  );
}