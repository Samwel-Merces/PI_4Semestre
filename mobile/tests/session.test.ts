import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  clearStoredSession,
  getUnauthorizedNotice,
  SESSION_EXPIRED_MESSAGE,
} from '../src/contexts/sessionLogic';
import { resolveNavigator } from '../src/navigation/resolveNavigator';
import { resolveStackTarget } from '../src/navigation/stackTargets';
import {
  AUTH_TOKEN_KEY,
  isValidSecureStoreKey,
  LEGACY_WEB_AUTH_TOKEN_KEY,
  secureStoreKeys,
} from '../src/storage/storageKeys';

describe('escolha do navegador', () => {
  it('mostra carregamento enquanto restaura a sessão (sem piscar o login)', () => {
    assert.equal(resolveNavigator(true, null), 'loading');
    assert.equal(resolveNavigator(true, { role: 'ADMIN' }), 'loading');
  });

  it('sem sessão abre a autenticação', () => {
    assert.equal(resolveNavigator(false, null), 'auth');
  });

  it('CLIENTE e ADMIN entram no fluxo correto', () => {
    assert.equal(resolveNavigator(false, { role: 'CLIENTE' }), 'client');
    assert.equal(resolveNavigator(false, { role: 'ADMIN' }), 'admin');
  });
});

describe('navegação sem telas duplicadas', () => {
  it('volta para a tela se ela já estiver na pilha', () => {
    assert.equal(
      resolveStackTarget(
        [{ name: 'Profile' }, { name: 'Appointments' }, { name: 'Services' }, { name: 'BookAppointment' }],
        'Appointments',
      ),
      'popTo',
    );
  });

  it('substitui a tela atual quando o destino não está na pilha', () => {
    assert.equal(
      resolveStackTarget([{ name: 'Services' }, { name: 'BookAppointment' }], 'Appointments'),
      'replace',
    );
  });
});

describe('logout e sessão expirada', () => {
  it('logout remove token e cache mesmo se uma etapa falhar', async () => {
    const removed: string[] = [];

    await clearStoredSession([
      async () => {
        removed.push('token');
      },
      async () => {
        throw new Error('SQLite indisponível');
      },
      async () => {
        removed.push('outro');
      },
    ]);

    assert.deepEqual(removed, ['token', 'outro']);
  });

  it('401 com usuário autenticado avisa sessão expirada', () => {
    assert.equal(getUnauthorizedNotice(true), SESSION_EXPIRED_MESSAGE);
  });

  it('401 sem usuário (ex.: senha errada no login) não avisa sessão expirada', () => {
    assert.equal(getUnauthorizedNotice(false), null);
  });
});

describe('chaves do SecureStore', () => {
  it('todas as chaves usam apenas letras, números, ".", "-" e "_"', () => {
    for (const key of secureStoreKeys) {
      assert.equal(isValidSecureStoreKey(key), true, key);
    }

    assert.equal(AUTH_TOKEN_KEY, 'petshop_auth_token');
  });

  it('rejeita "@" e ":"', () => {
    assert.equal(isValidSecureStoreKey(LEGACY_WEB_AUTH_TOKEN_KEY), false);
    assert.equal(isValidSecureStoreKey('a:b'), false);
    assert.equal(isValidSecureStoreKey('@a'), false);
    assert.equal(isValidSecureStoreKey(''), false);
  });

  it('o código só chama o SecureStore com chaves declaradas e válidas', () => {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const files: string[] = [];

    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);

        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(name)) {
          files.push(full);
        }
      }
    };

    walk(src);

    const call = /SecureStore\.\w+Async\(\s*([^,)\s]+)/g;
    const keyNames: Record<string, string> = { AUTH_TOKEN_KEY };
    let calls = 0;

    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(call)) {
        calls += 1;

        const argument = match[1];
        const literal = /^['"`](.*)['"`]$/.exec(argument);
        const key = literal ? literal[1] : keyNames[argument];

        assert.ok(key, `chave não reconhecida em ${file}: ${argument}`);
        assert.equal(isValidSecureStoreKey(key), true, `${file}: ${key}`);
      }
    }

    assert.ok(calls > 0);
  });
});
