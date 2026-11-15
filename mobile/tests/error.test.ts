import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  apiErrorMessages,
  getApiErrorKind,
  getApiErrorMessage,
  getApiFieldErrors,
  isNetworkError,
  isUnauthorizedError,
} from '../src/utils/error';

/* Formato mínimo reconhecido por axios.isAxiosError. */
function apiError(
  status: number,
  data?: unknown,
): { isAxiosError: true; response: { status: number; data: unknown } } {
  return { isAxiosError: true, response: { status, data } };
}

function body(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}

describe('mapeamento de erros da API', () => {
  it('400/422: dados inválidos', () => {
    assert.equal(getApiErrorKind(apiError(400)), 'validation');
    assert.equal(getApiErrorKind(apiError(422)), 'validation');
    assert.equal(getApiErrorMessage(apiError(422)), apiErrorMessages.validation);
  });

  it('401 de sessão: mensagem de sessão expirada', () => {
    const error = apiError(401, body('INVALID_TOKEN', 'Token inválido ou expirado.'));

    assert.equal(getApiErrorKind(error), 'unauthorized');
    assert.equal(getApiErrorMessage(error), apiErrorMessages.unauthorized);
    assert.equal(isUnauthorizedError(error), true);
  });

  it('401 no login: mostra "e-mail ou senha inválidos", não sessão expirada', () => {
    const error = apiError(
      401,
      body('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.'),
    );

    assert.equal(getApiErrorKind(error), 'invalidCredentials');
    assert.equal(getApiErrorMessage(error), 'E-mail ou senha inválidos.');
  });

  it('403: acesso não permitido', () => {
    assert.equal(getApiErrorKind(apiError(403)), 'forbidden');
    assert.equal(getApiErrorMessage(apiError(403)), apiErrorMessages.forbidden);
  });

  it('409: usa a mensagem específica do conflito', () => {
    assert.equal(
      getApiErrorMessage(apiError(409, body('EMAIL_IN_USE', 'E-mail já cadastrado.'))),
      'E-mail já cadastrado.',
    );
    assert.equal(
      getApiErrorMessage(
        apiError(409, body('SLOT_UNAVAILABLE', 'Horário indisponível. Escolha outro horário.')),
      ),
      'Horário indisponível. Escolha outro horário.',
    );
    assert.equal(getApiErrorMessage(apiError(409)), apiErrorMessages.conflict);
  });

  it('sem resposta: falha de conexão ou tempo esgotado', () => {
    const network = { isAxiosError: true, code: 'ERR_NETWORK' };
    const timeout = { isAxiosError: true, code: 'ECONNABORTED' };

    assert.equal(getApiErrorMessage(network), apiErrorMessages.network);
    assert.equal(getApiErrorMessage(timeout), apiErrorMessages.timeout);
    assert.equal(isNetworkError(network), true);
  });

  it('500: mensagem amigável, sem expor detalhes internos', () => {
    const error = apiError(500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'TypeError: cannot read x\n    at Object.<anonymous> (server.ts:10)',
      },
    });

    assert.equal(getApiErrorKind(error), 'server');
    assert.equal(getApiErrorMessage(error), apiErrorMessages.server);
  });

  it('erro que não é do axios usa a mensagem própria ou o fallback', () => {
    assert.equal(getApiErrorMessage(new Error('Falhou.')), 'Falhou.');
    assert.equal(getApiErrorMessage('x', 'Padrão.'), 'Padrão.');
  });
});

describe('erros por campo (Zod)', () => {
  it('distribui os detalhes de validação pelos campos conhecidos', () => {
    const error = apiError(
      400,
      body('VALIDATION_ERROR', 'Dados inválidos.', [
        { path: ['email'], message: 'Informe um endereço de e-mail válido.' },
        { path: ['phone'], message: 'Informe um telefone com DDD (10 ou 11 dígitos).' },
        { path: ['desconhecido'], message: 'ignorar' },
        { path: ['email'], message: 'segunda mensagem ignorada' },
      ]),
    );

    assert.deepEqual(getApiFieldErrors(error, ['name', 'email', 'phone']), {
      email: 'Informe um endereço de e-mail válido.',
      phone: 'Informe um telefone com DDD (10 ou 11 dígitos).',
    });
  });

  it('ignora respostas sem detalhes', () => {
    assert.deepEqual(getApiFieldErrors(apiError(500), ['email']), {});
    assert.deepEqual(getApiFieldErrors(new Error('x'), ['email']), {});
  });
});
