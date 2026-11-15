import { parseCurrencyInputToCents } from './currency';
import { toDateKey } from './date';

/*
 * Regras e mensagens de validação compartilhadas pelos formulários.
 * Os limites acompanham os schemas Zod do backend
 * (arquivos *.schemas.ts em backend/src/modules) para não haver divergência.
 *
 * Cada validador devolve a mensagem de erro ou null quando o valor é válido.
 */
export type ValidationResult = string | null;

export const limits = {
  userNameMax: 100,
  petNameMax: 80,
  productNameMax: 120,
  serviceNameMax: 80,
  nameMin: 2,
  emailMax: 180,
  passwordMin: 8,
  passwordMax: 72,
  productDescriptionMax: 2000,
  serviceDescriptionMax: 500,
  descriptionMin: 5,
  imageUrlMax: 2048,
  breedMax: 80,
  notesMax: 500,
  cartQuantityMax: 99,
  durationMin: 30,
  durationMax: 480,
  durationStep: 30,
  phoneInputMax: 20,
} as const;

export const validationMessages = {
  nameRequired: 'Informe o nome.',
  nameMin: `O nome deve possuir pelo menos ${limits.nameMin} caracteres.`,
  nameMax: (max: number) =>
    `O nome deve possuir no máximo ${max} caracteres.`,
  emailRequired: 'Informe o e-mail.',
  emailInvalid: 'Informe um endereço de e-mail válido.',
  emailMax: `O e-mail deve possuir no máximo ${limits.emailMax} caracteres.`,
  phoneRequired: 'Informe o telefone.',
  phoneInvalid: 'Informe um telefone com DDD (10 ou 11 dígitos).',
  passwordRequired: 'Informe a senha.',
  passwordMin: `A senha deve possuir pelo menos ${limits.passwordMin} caracteres.`,
  passwordMax: `A senha deve possuir no máximo ${limits.passwordMax} caracteres.`,
  currentPasswordRequired: 'Informe a senha atual.',
  confirmationRequired: 'Confirme a senha.',
  confirmationMismatch: 'As senhas não são iguais.',
  descriptionRequired: 'Informe a descrição.',
  descriptionMin: `A descrição deve possuir pelo menos ${limits.descriptionMin} caracteres.`,
  descriptionMax: (max: number) =>
    `A descrição deve possuir no máximo ${max} caracteres.`,
  priceRequired: 'Informe o preço.',
  priceInvalid: 'Informe um preço maior que zero, por exemplo 49,90.',
  stockRequired: 'Informe a quantidade em estoque.',
  stockInvalid: 'O estoque deve ser um número inteiro igual ou maior que zero.',
  quantityInvalid: 'A quantidade deve ser um número inteiro maior que zero.',
  outOfStock: 'O produto está sem estoque.',
  quantityAboveStock: (available: number) =>
    `Quantidade indisponível. Existem ${available} unidade(s) disponíveis.`,
  quantityAboveMax: `A quantidade máxima por produto é ${limits.cartQuantityMax}.`,
  imageUrlRequired: 'Informe a URL da imagem.',
  imageUrlInvalid: 'Informe uma URL de imagem válida, começando com http:// ou https://.',
  imageUrlMax: `A URL da imagem deve possuir no máximo ${limits.imageUrlMax} caracteres.`,
  durationInvalid: `A duração deve ser múltipla de ${limits.durationStep} minutos, entre ${limits.durationMin} e ${limits.durationMax}.`,
  birthDateInvalid: 'Informe uma data de nascimento válida no formato DD/MM/AAAA, que não seja futura.',
  weightInvalid: 'Informe um peso maior que zero e de até 200 kg.',
  breedMax: `A raça deve possuir no máximo ${limits.breedMax} caracteres.`,
  notesMax: `As observações devem possuir no máximo ${limits.notesMax} caracteres.`,
  petRequired: 'Escolha o pet.',
  datePast: 'Escolha uma data a partir de hoje.',
  slotRequired: 'Escolha um horário.',
  slotUnavailable: 'Horário indisponível. Escolha outro horário.',
} as const;

/* Mesma expressão usada por z.string().email() no backend (Zod 4). */
const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

const HTTP_URL_PATTERN = /^https?:\/\/[^\s/?#]+\.[^\s]+$/i;

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/* Remove espaços externos e reduz espaços internos repetidos. Usar só no envio. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/* Texto livre opcional: vazio vira null. */
export function normalizeOptionalText(value: string): string | null {
  const text = value.trim();

  return text ? text : null;
}

/*
 * Mantém somente os dígitos do telefone.
 * Remove o código do país (+55) e zeros de discagem à esquerda,
 * para que números colados como "+55 (11) 91234-5678" funcionem.
 */
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');

  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  digits = digits.replace(/^0+/, '');

  return digits;
}

/*
 * Máscara brasileira aplicada durante a digitação:
 * (11) 1234-5678 para fixo e (11) 91234-5678 para celular.
 * Separadores só aparecem quando já existe um dígito depois deles,
 * para não atrapalhar o apagar.
 */
export function formatPhone(value: string): string {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);

  if (number.length <= 4) {
    return `(${ddd}) ${number}`;
  }

  const splitAt = digits.length === 11 ? 5 : 4;

  return `(${ddd}) ${number.slice(0, splitAt)}-${number.slice(splitAt)}`;
}

/* Máscara DD/MM/AAAA aplicada durante a digitação. */
export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/* Inteiro não negativo escrito somente com dígitos; caso contrário, null. */
export function parseNonNegativeInteger(value: string): number | null {
  const text = value.trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);

  return Number.isSafeInteger(number) ? number : null;
}

// ---------------------------------------------------------------------------
// Validação de campos
// ---------------------------------------------------------------------------

export function validateName(
  value: string,
  max: number = limits.userNameMax,
): ValidationResult {
  const name = normalizeName(value);

  if (!name) {
    return validationMessages.nameRequired;
  }

  if (name.length < limits.nameMin) {
    return validationMessages.nameMin;
  }

  if (name.length > max) {
    return validationMessages.nameMax(max);
  }

  return null;
}

export function validateEmail(value: string): ValidationResult {
  const email = normalizeEmail(value);

  if (!email) {
    return validationMessages.emailRequired;
  }

  if (email.length > limits.emailMax) {
    return validationMessages.emailMax;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return validationMessages.emailInvalid;
  }

  return null;
}

export function validatePhone(value: string): ValidationResult {
  const digits = normalizePhone(value);

  if (!digits) {
    return validationMessages.phoneRequired;
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return validationMessages.phoneInvalid;
  }

  return null;
}

export function isValidPhone(value: string): boolean {
  return validatePhone(value) === null;
}

/* Senha nova: 8 a 72 caracteres. O valor nunca é alterado (sem trim). */
export function validatePassword(value: string): ValidationResult {
  if (!value) {
    return validationMessages.passwordRequired;
  }

  if (value.length < limits.passwordMin) {
    return validationMessages.passwordMin;
  }

  if (value.length > limits.passwordMax) {
    return validationMessages.passwordMax;
  }

  return null;
}

/* Senha existente (login, senha atual): o backend exige apenas que seja informada. */
export function validateRequiredPassword(
  value: string,
  message: string = validationMessages.passwordRequired,
): ValidationResult {
  return value ? null : message;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): ValidationResult {
  if (!confirmation) {
    return validationMessages.confirmationRequired;
  }

  if (password !== confirmation) {
    return validationMessages.confirmationMismatch;
  }

  return null;
}

export function validateDescription(
  value: string,
  max: number,
): ValidationResult {
  const text = value.trim();

  if (!text) {
    return validationMessages.descriptionRequired;
  }

  if (text.length < limits.descriptionMin) {
    return validationMessages.descriptionMin;
  }

  if (text.length > max) {
    return validationMessages.descriptionMax(max);
  }

  return null;
}

export function validatePrice(value: string): ValidationResult {
  if (!value.trim()) {
    return validationMessages.priceRequired;
  }

  return parseCurrencyInputToCents(value) === null
    ? validationMessages.priceInvalid
    : null;
}

export function validateStock(value: string): ValidationResult {
  if (!value.trim()) {
    return validationMessages.stockRequired;
  }

  return parseNonNegativeInteger(value) === null
    ? validationMessages.stockInvalid
    : null;
}

/* Quantidade do carrinho: inteira, >= 1, <= estoque disponível e <= 99. */
export function validateQuantity(
  quantity: number,
  available: number,
): ValidationResult {
  if (available <= 0) {
    return validationMessages.outOfStock;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return validationMessages.quantityInvalid;
  }

  if (quantity > limits.cartQuantityMax) {
    return validationMessages.quantityAboveMax;
  }

  if (quantity > available) {
    return validationMessages.quantityAboveStock(available);
  }

  return null;
}

export function validateImageUrl(value: string): ValidationResult {
  const url = value.trim();

  if (!url) {
    return validationMessages.imageUrlRequired;
  }

  if (url.length > limits.imageUrlMax) {
    return validationMessages.imageUrlMax;
  }

  return HTTP_URL_PATTERN.test(url)
    ? null
    : validationMessages.imageUrlInvalid;
}

export function validateDuration(value: string): ValidationResult {
  const minutes = parseNonNegativeInteger(value);

  if (
    minutes === null ||
    minutes < limits.durationMin ||
    minutes > limits.durationMax ||
    minutes % limits.durationStep !== 0
  ) {
    return validationMessages.durationInvalid;
  }

  return null;
}

export function validateMaxLength(
  value: string,
  max: number,
  message: string,
): ValidationResult {
  return value.trim().length > max ? message : null;
}

// ---------------------------------------------------------------------------
// Pet
// ---------------------------------------------------------------------------

export function parseBirthDate(
  value: string,
  now: Date = new Date(),
): string | null | undefined {
  const text = value.trim();

  if (!text) {
    return null;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);

  if (!match) {
    return undefined;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() <= now.getTime();

  return valid ? date.toISOString() : undefined;
}

export function formatBirthDate(
  iso: string | null,
): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  return [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCFullYear()),
  ].join('/');
}

export function parseWeight(
  value: string,
): number | null | undefined {
  const text = value.trim().replace(',', '.');

  if (!text) {
    return null;
  }

  if (!/^\d+(\.\d+)?$/.test(text)) {
    return undefined;
  }

  const weight = Number(text);

  if (!Number.isFinite(weight) || weight <= 0 || weight > 200) {
    return undefined;
  }

  return weight;
}

export function validateBirthDate(value: string): ValidationResult {
  return parseBirthDate(value) === undefined
    ? validationMessages.birthDateInvalid
    : null;
}

export function validateWeight(value: string): ValidationResult {
  return parseWeight(value) === undefined
    ? validationMessages.weightInvalid
    : null;
}

// ---------------------------------------------------------------------------
// Agendamento
// ---------------------------------------------------------------------------

export interface BookingSelection {
  petId: string | null;
  date: string;
  slot: string | null;
  availableSlots: readonly string[];
}

export type BookingErrors = Partial<
  Record<'petId' | 'date' | 'slot', string>
>;

/*
 * A data é uma chave AAAA-MM-DD no fuso da loja (UTC-3) e o horário
 * precisa ser uma das opções devolvidas pela API de disponibilidade.
 */
export function validateBookingSelection(
  selection: BookingSelection,
  now: Date = new Date(),
): BookingErrors {
  const errors: BookingErrors = {};

  if (!selection.petId) {
    errors.petId = validationMessages.petRequired;
  }

  if (selection.date < toDateKey(now)) {
    errors.date = validationMessages.datePast;
  }

  if (!selection.slot) {
    errors.slot = validationMessages.slotRequired;
  } else if (
    !selection.availableSlots.includes(selection.slot) ||
    new Date(selection.slot).getTime() <= now.getTime()
  ) {
    errors.slot = validationMessages.slotUnavailable;
  }

  return errors;
}
