import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCurrencyInputToCents } from '../src/utils/currency';
import { hasErrors } from '../src/utils/form';
import {
  validateLoginForm,
  validatePasswordChangeForm,
  validateRegisterForm,
} from '../src/utils/formRules';
import {
  formatDateInput,
  formatPhone,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseBirthDate,
  validateBookingSelection,
  validateDuration,
  validateEmail,
  validateImageUrl,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
  validatePrice,
  validateQuantity,
  validateStock,
  validationMessages,
} from '../src/utils/validacoes';

describe('nome', () => {
  it('rejeita nome vazio ou só com espaços', () => {
    assert.equal(validateName(''), validationMessages.nameRequired);
    assert.equal(validateName('   '), validationMessages.nameRequired);
  });

  it('rejeita nome curto após normalização', () => {
    assert.equal(validateName('A'), validationMessages.nameMin);
    assert.equal(validateName('  A  '), validationMessages.nameMin);
  });

  it('aceita nome com 2 caracteres e respeita o máximo', () => {
    assert.equal(validateName('Al'), null);
    assert.equal(validateName('a'.repeat(100)), null);
    assert.equal(
      validateName('a'.repeat(101)),
      validationMessages.nameMax(100),
    );
    assert.equal(validateName('a'.repeat(81), 80), validationMessages.nameMax(80));
  });

  it('normaliza espaços externos e internos repetidos', () => {
    assert.equal(normalizeName('  Maria   da  Silva '), 'Maria da Silva');
  });
});

describe('e-mail', () => {
  it('rejeita e-mail vazio e inválido', () => {
    assert.equal(validateEmail(''), validationMessages.emailRequired);
    assert.equal(validateEmail('maria'), validationMessages.emailInvalid);
    assert.equal(validateEmail('maria@'), validationMessages.emailInvalid);
    assert.equal(validateEmail('maria@site'), validationMessages.emailInvalid);
    assert.equal(validateEmail('ma ria@site.com'), validationMessages.emailInvalid);
  });

  it('aceita e-mail válido com espaços e maiúsculas', () => {
    assert.equal(validateEmail('  Maria.Silva@Exemplo.COM '), null);
  });

  it('normaliza para minúsculas sem espaços', () => {
    assert.equal(
      normalizeEmail('  Maria.Silva@Exemplo.COM '),
      'maria.silva@exemplo.com',
    );
  });
});

describe('telefone', () => {
  it('extrai somente os dígitos', () => {
    assert.equal(normalizePhone('(11) 91234-5678'), '11912345678');
    assert.equal(normalizePhone('11 3456-7890'), '1134567890');
  });

  it('remove +55 e zero de discagem de números colados', () => {
    assert.equal(normalizePhone('+55 (11) 91234-5678'), '11912345678');
    assert.equal(normalizePhone('011 91234-5678'), '11912345678');
  });

  it('aplica a máscara progressivamente durante a digitação', () => {
    assert.equal(formatPhone(''), '');
    assert.equal(formatPhone('1'), '(1');
    assert.equal(formatPhone('11'), '(11');
    assert.equal(formatPhone('119'), '(11) 9');
    assert.equal(formatPhone('113456'), '(11) 3456');
    assert.equal(formatPhone('1134567'), '(11) 3456-7');
    assert.equal(formatPhone('1134567890'), '(11) 3456-7890');
    assert.equal(formatPhone('11912345678'), '(11) 91234-5678');
  });

  it('formata texto colado com máscara ou código do país', () => {
    assert.equal(formatPhone('+55 11 91234-5678'), '(11) 91234-5678');
    assert.equal(formatPhone('11912345678999'), '(11) 91234-5678');
  });

  it('não impede apagar: remover o separador volta ao formato anterior', () => {
    // Ao apagar o último dígito, o separador que sobrou também sai.
    assert.equal(formatPhone('(11) 3456-'), '(11) 3456');
    assert.equal(formatPhone('(11) '), '(11');
    assert.equal(formatPhone('('), '');
  });

  it('aceita 10 (fixo) e 11 (celular) dígitos', () => {
    assert.equal(validatePhone('(11) 3456-7890'), null);
    assert.equal(validatePhone('(11) 91234-5678'), null);
  });

  it('rejeita telefone vazio, curto ou longo demais', () => {
    assert.equal(validatePhone(''), validationMessages.phoneRequired);
    assert.equal(validatePhone('(11) 9123-456'), validationMessages.phoneInvalid);
    assert.equal(validatePhone('123456789012'), validationMessages.phoneInvalid);
    assert.equal(validatePhone('abc'), validationMessages.phoneRequired);
  });
});

describe('senha', () => {
  it('rejeita senha vazia, com menos de 8 e com mais de 72 caracteres', () => {
    assert.equal(validatePassword(''), validationMessages.passwordRequired);
    assert.equal(validatePassword('1234567'), validationMessages.passwordMin);
    assert.equal(validatePassword('a'.repeat(73)), validationMessages.passwordMax);
  });

  it('aceita os limites de 8 e 72 caracteres', () => {
    assert.equal(validatePassword('12345678'), null);
    assert.equal(validatePassword('a'.repeat(72)), null);
  });

  it('não aplica trim: espaços contam como caracteres', () => {
    assert.equal(validatePassword(' 123456 '), null);
    assert.equal(validatePassword('       '), validationMessages.passwordMin);
  });

  it('exige confirmação idêntica', () => {
    assert.equal(
      validatePasswordConfirmation('Senha@123', ''),
      validationMessages.confirmationRequired,
    );
    assert.equal(
      validatePasswordConfirmation('Senha@123', 'Senha@124'),
      validationMessages.confirmationMismatch,
    );
    assert.equal(
      validatePasswordConfirmation('Senha@123', 'Senha@123 '),
      validationMessages.confirmationMismatch,
    );
    assert.equal(validatePasswordConfirmation('Senha@123', 'Senha@123'), null);
  });
});

describe('valores numéricos', () => {
  it('converte preço em centavos sem erro de ponto flutuante', () => {
    assert.equal(parseCurrencyInputToCents('49,90'), 4990);
    assert.equal(parseCurrencyInputToCents('49.90'), 4990);
    assert.equal(parseCurrencyInputToCents('0,1'), 10);
    assert.equal(parseCurrencyInputToCents('1.234,56'), 123456);
    assert.equal(parseCurrencyInputToCents('1.000'), 100000);
    assert.equal(parseCurrencyInputToCents('R$ 10'), 1000);
    assert.equal(parseCurrencyInputToCents('19,99'), 1999);
  });

  it('rejeita preço zero, negativo ou inválido', () => {
    assert.equal(parseCurrencyInputToCents('0'), null);
    assert.equal(parseCurrencyInputToCents('0,00'), null);
    assert.equal(parseCurrencyInputToCents('-5'), null);
    assert.equal(parseCurrencyInputToCents('abc'), null);
    assert.equal(parseCurrencyInputToCents('10,,5'), null);
    assert.equal(validatePrice(''), validationMessages.priceRequired);
    assert.equal(validatePrice('0'), validationMessages.priceInvalid);
    assert.equal(validatePrice('12,50'), null);
  });

  it('exige estoque inteiro e maior ou igual a zero', () => {
    assert.equal(validateStock(''), validationMessages.stockRequired);
    assert.equal(validateStock('-1'), validationMessages.stockInvalid);
    assert.equal(validateStock('1.5'), validationMessages.stockInvalid);
    assert.equal(validateStock('0'), null);
    assert.equal(validateStock('25'), null);
  });

  it('exige quantidade inteira, >= 1 e <= estoque disponível', () => {
    assert.equal(validateQuantity(0, 5), validationMessages.quantityInvalid);
    assert.equal(validateQuantity(1.5, 5), validationMessages.quantityInvalid);
    assert.equal(validateQuantity(6, 5), validationMessages.quantityAboveStock(5));
    assert.equal(validateQuantity(100, 500), validationMessages.quantityAboveMax);
    assert.equal(validateQuantity(1, 0), validationMessages.outOfStock);
    assert.equal(validateQuantity(5, 5), null);
  });

  it('exige duração múltipla de 30 entre 30 e 480 minutos', () => {
    assert.equal(validateDuration('15'), validationMessages.durationInvalid);
    assert.equal(validateDuration('45'), validationMessages.durationInvalid);
    assert.equal(validateDuration('510'), validationMessages.durationInvalid);
    assert.equal(validateDuration('30'), null);
    assert.equal(validateDuration('480'), null);
  });
});

describe('URL e datas', () => {
  it('aceita somente URLs http(s)', () => {
    assert.equal(validateImageUrl(''), validationMessages.imageUrlRequired);
    assert.equal(validateImageUrl('ftp://x.com/a.png'), validationMessages.imageUrlInvalid);
    assert.equal(validateImageUrl('imagem.png'), validationMessages.imageUrlInvalid);
    assert.equal(validateImageUrl('https://images.pexels.com/a.jpg'), null);
  });

  it('aplica máscara de data sem bloquear apagar', () => {
    assert.equal(formatDateInput('1'), '1');
    assert.equal(formatDateInput('150'), '15/0');
    assert.equal(formatDateInput('15032020'), '15/03/2020');
    assert.equal(formatDateInput('15/03/'), '15/03');
  });

  it('rejeita data de nascimento futura ou inexistente', () => {
    const now = new Date('2026-11-14T12:00:00Z');

    assert.equal(parseBirthDate('', now), null);
    assert.equal(parseBirthDate('31/02/2020', now), undefined);
    assert.equal(parseBirthDate('15/12/2026', now), undefined);
    assert.equal(parseBirthDate('15/03/2020', now), '2020-03-15T00:00:00.000Z');
  });
});

describe('agendamento', () => {
  // 14/11/2026 12:00 em UTC equivale a 09:00 no horário da loja (UTC-3).
  const now = new Date('2026-11-14T12:00:00Z');
  const slots = ['2026-11-14T15:00:00.000Z', '2026-11-14T16:00:00.000Z'];

  it('exige pet e horário', () => {
    const errors = validateBookingSelection(
      { petId: null, date: '2026-11-14', slot: null, availableSlots: slots },
      now,
    );

    assert.equal(errors.petId, validationMessages.petRequired);
    assert.equal(errors.slot, validationMessages.slotRequired);
  });

  it('não permite data no passado', () => {
    const errors = validateBookingSelection(
      { petId: 'p', date: '2026-11-13', slot: slots[0], availableSlots: slots },
      now,
    );

    assert.equal(errors.date, validationMessages.datePast);
  });

  it('exige horário entre as opções disponíveis e futuro', () => {
    assert.equal(
      validateBookingSelection(
        { petId: 'p', date: '2026-11-14', slot: '2026-11-14T17:00:00.000Z', availableSlots: slots },
        now,
      ).slot,
      validationMessages.slotUnavailable,
    );

    assert.equal(
      validateBookingSelection(
        { petId: 'p', date: '2026-11-14', slot: slots[0], availableSlots: slots },
        new Date('2026-11-14T15:30:00Z'),
      ).slot,
      validationMessages.slotUnavailable,
    );
  });

  it('aceita seleção válida', () => {
    assert.deepEqual(
      validateBookingSelection(
        { petId: 'p', date: '2026-11-14', slot: slots[1], availableSlots: slots },
        now,
      ),
      {},
    );
  });
});

describe('formulários (envio bloqueado quando inválido)', () => {
  const validRegister = {
    name: '  Maria  Silva ',
    email: 'Maria@Exemplo.com',
    phone: '(11) 91234-5678',
    password: 'Senha@123',
    passwordConfirmation: 'Senha@123',
  };

  it('cadastro válido não tem erros', () => {
    assert.equal(hasErrors(validateRegisterForm(validRegister)), false);
  });

  it('cadastro inválido bloqueia o envio e aponta cada campo', () => {
    const errors = validateRegisterForm({
      name: 'M',
      email: 'maria',
      phone: '1234',
      password: '123',
      passwordConfirmation: '321',
    });

    assert.equal(hasErrors(errors), true);
    assert.deepEqual(Object.keys(errors).sort(), [
      'email',
      'name',
      'password',
      'passwordConfirmation',
      'phone',
    ]);
  });

  it('login exige apenas senha informada (contrato do backend)', () => {
    assert.deepEqual(
      validateLoginForm({ email: 'cliente@example.com', password: '123' }),
      {},
    );
    assert.equal(
      validateLoginForm({ email: 'cliente@example.com', password: '' }).password,
      validationMessages.passwordRequired,
    );
  });

  it('troca de senha exige senha atual e confirmação', () => {
    const errors = validatePasswordChangeForm({
      currentPassword: '',
      newPassword: 'NovaSenha1',
      newPasswordConfirmation: 'Outra',
    });

    assert.equal(errors.currentPassword, validationMessages.currentPasswordRequired);
    assert.equal(errors.newPasswordConfirmation, validationMessages.confirmationMismatch);
  });
});
