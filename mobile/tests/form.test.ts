import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  focusField,
  getFirstInvalidField,
  getVisibleErrors,
  isFormDirty,
  runExclusive,
  type SubmitLock,
} from '../src/utils/form';

describe('exibição de erros', () => {
  const validationErrors = {
    name: 'Informe o nome.',
    email: 'Informe o e-mail.',
  };

  it('não exibe erros na abertura da tela', () => {
    assert.deepEqual(getVisibleErrors(validationErrors, {}), {});
  });

  it('exibe somente o erro do campo que perdeu o foco', () => {
    assert.deepEqual(getVisibleErrors(validationErrors, { name: true }), {
      name: 'Informe o nome.',
    });
  });

  it('remove o erro quando o valor fica válido', () => {
    assert.deepEqual(getVisibleErrors({}, { name: true, email: true }), {});
  });

  it('mantém o erro da API até o campo ser editado', () => {
    assert.deepEqual(
      getVisibleErrors({}, {}, { email: 'Este e-mail já está cadastrado.' }),
      { email: 'Este e-mail já está cadastrado.' },
    );
  });

  it('indica o primeiro campo inválido na ordem do formulário', () => {
    assert.equal(
      getFirstInvalidField(['name', 'email', 'phone'], {
        phone: 'x',
        email: 'y',
      }),
      'email',
    );
    assert.equal(getFirstInvalidField(['name'], {}), null);
  });

  it('leva o foco ao campo indicado', () => {
    const focused: string[] = [];
    const ref = (name: string) => ({
      current: { focus: () => focused.push(name) },
    });

    focusField<'name' | 'email'>(
      { name: ref('name'), email: ref('email') },
      'email',
    );
    focusField({ name: ref('name') }, null);

    assert.deepEqual(focused, ['email']);
  });
});

describe('descarte de formulário', () => {
  const initial = { name: '', email: '', category: 'RACAO', active: true };

  it('formulário vazio sem alterações não pede confirmação', () => {
    assert.equal(isFormDirty(initial, { ...initial }), false);
  });

  it('formulário modificado pede confirmação', () => {
    assert.equal(isFormDirty(initial, { ...initial, name: 'Rex' }), true);
    assert.equal(isFormDirty(initial, { ...initial, active: false }), true);
  });

  it('voltar ao valor original deixa de pedir confirmação', () => {
    assert.equal(isFormDirty(initial, { ...initial, name: '' }), false);
  });
});

describe('envio único durante loading', () => {
  it('ignora novos envios enquanto o primeiro está em andamento', async () => {
    const lock: SubmitLock = { current: false };
    let calls = 0;
    let release: () => void = () => undefined;

    const task = () =>
      new Promise<string>((resolve) => {
        calls += 1;
        release = () => resolve('ok');
      });

    const first = runExclusive(lock, task);
    const second = runExclusive(lock, task);
    const third = runExclusive(lock, task);

    release();

    assert.equal(await first, 'ok');
    assert.equal(await second, undefined);
    assert.equal(await third, undefined);
    assert.equal(calls, 1);
  });

  it('libera a trava depois de erro, preservando a possibilidade de reenviar', async () => {
    const lock: SubmitLock = { current: false };

    await assert.rejects(
      runExclusive(lock, async () => {
        throw new Error('falha');
      }),
    );

    assert.equal(lock.current, false);
    assert.equal(await runExclusive(lock, async () => 42), 42);
  });
});
