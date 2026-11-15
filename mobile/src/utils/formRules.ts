import type { FieldErrors } from './form';

import {
  limits,
  validateBirthDate,
  validateDescription,
  validateDuration,
  validateEmail,
  validateImageUrl,
  validateMaxLength,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
  validatePrice,
  validateRequiredPassword,
  validateStock,
  validateWeight,
  validationMessages,
  type ValidationResult,
} from './validacoes';

/*
 * Validação de cada formulário, montada a partir das regras de
 * validacoes.ts. Os hooks apenas chamam estas funções, sem repetir regras.
 */
function collect<Field extends string>(
  entries: Record<Field, ValidationResult>,
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};

  for (const field of Object.keys(entries) as Field[]) {
    const message = entries[field];

    if (message) {
      errors[field] = message;
    }
  }

  return errors;
}

export type LoginValues = {
  email: string;
  password: string;
};

export function validateLoginForm(
  values: LoginValues,
): FieldErrors<keyof LoginValues> {
  return collect({
    email: validateEmail(values.email),
    password: validateRequiredPassword(values.password),
  });
}

export type RegisterValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
};

export function validateRegisterForm(
  values: RegisterValues,
): FieldErrors<keyof RegisterValues> {
  return collect({
    name: validateName(values.name, limits.userNameMax),
    email: validateEmail(values.email),
    phone: validatePhone(values.phone),
    password: validatePassword(values.password),
    passwordConfirmation: validatePasswordConfirmation(
      values.password,
      values.passwordConfirmation,
    ),
  });
}

export type ForgotPasswordValues = {
  email: string;
};

export function validateForgotPasswordForm(
  values: ForgotPasswordValues,
): FieldErrors<keyof ForgotPasswordValues> {
  return collect({
    email: validateEmail(values.email),
  });
}

export type ResetPasswordValues = {
  password: string;
  passwordConfirmation: string;
};

export function validateResetPasswordForm(
  values: ResetPasswordValues,
): FieldErrors<keyof ResetPasswordValues> {
  return collect({
    password: validatePassword(values.password),
    passwordConfirmation: validatePasswordConfirmation(
      values.password,
      values.passwordConfirmation,
    ),
  });
}

export type ProfileValues = {
  name: string;
  phone: string;
};

export function validateProfileForm(
  values: ProfileValues,
): FieldErrors<keyof ProfileValues> {
  return collect({
    name: validateName(values.name, limits.userNameMax),
    phone: validatePhone(values.phone),
  });
}

export type PasswordChangeValues = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
};

export function validatePasswordChangeForm(
  values: PasswordChangeValues,
): FieldErrors<keyof PasswordChangeValues> {
  return collect({
    currentPassword: validateRequiredPassword(
      values.currentPassword,
      validationMessages.currentPasswordRequired,
    ),
    newPassword: validatePassword(values.newPassword),
    newPasswordConfirmation: validatePasswordConfirmation(
      values.newPassword,
      values.newPasswordConfirmation,
    ),
  });
}

export type ProductTextValues = {
  name: string;
  description: string;
  price: string;
  stock: string;
  imageUrl: string;
};

export function validateProductForm(
  values: ProductTextValues,
): FieldErrors<keyof ProductTextValues> {
  return collect({
    name: validateName(values.name, limits.productNameMax),
    description: validateDescription(
      values.description,
      limits.productDescriptionMax,
    ),
    price: validatePrice(values.price),
    stock: validateStock(values.stock),
    imageUrl: validateImageUrl(values.imageUrl),
  });
}

export type PetTextValues = {
  name: string;
  breed: string;
  birthDate: string;
  weight: string;
  notes: string;
};

export function validatePetForm(
  values: PetTextValues,
): FieldErrors<keyof PetTextValues> {
  return collect({
    name: validateName(values.name, limits.petNameMax),
    breed: validateMaxLength(
      values.breed,
      limits.breedMax,
      validationMessages.breedMax,
    ),
    birthDate: validateBirthDate(values.birthDate),
    weight: validateWeight(values.weight),
    notes: validateMaxLength(
      values.notes,
      limits.notesMax,
      validationMessages.notesMax,
    ),
  });
}

export type ServiceValues = {
  name: string;
  description: string;
  duration: string;
  priceSmall: string;
  priceMedium: string;
  priceLarge: string;
};

export function validateServiceForm(
  values: ServiceValues,
): FieldErrors<keyof ServiceValues> {
  return collect({
    name: validateName(values.name, limits.serviceNameMax),
    description: validateDescription(
      values.description,
      limits.serviceDescriptionMax,
    ),
    duration: validateDuration(values.duration),
    priceSmall: validatePrice(values.priceSmall),
    priceMedium: validatePrice(values.priceMedium),
    priceLarge: validatePrice(values.priceLarge),
  });
}
