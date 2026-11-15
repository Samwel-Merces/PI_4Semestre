export function formatCurrency(
  valueInCents: number,
): string {
  const normalizedValue =
    Number.isFinite(valueInCents)
      ? valueInCents
      : 0;

  return (
    normalizedValue / 100
  ).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/*
 * Converte o texto digitado em centavos, sem aritmética de ponto flutuante.
 * Aceita "49,90", "49.90", "1.234,50", "R$ 10" e "1000".
 * O último separador seguido de 1 ou 2 dígitos é tratado como decimal;
 * os demais são separadores de milhar. Retorna null se o valor for
 * inválido ou não for maior que zero.
 */
export function parseCurrencyInputToCents(
  value: string,
): number | null {
  const normalizedValue = value
    .trim()
    .replace(/^R\$/i, '')
    .replace(/\s/g, '');

  if (!/^\d+([.,]\d+)*$/.test(normalizedValue)) {
    return null;
  }

  const lastSeparator = Math.max(
    normalizedValue.lastIndexOf(','),
    normalizedValue.lastIndexOf('.'),
  );

  const decimalDigits =
    lastSeparator >= 0
      ? normalizedValue.length - lastSeparator - 1
      : 0;

  const hasDecimals =
    lastSeparator >= 0 && decimalDigits <= 2;

  const integerPart = (
    hasDecimals
      ? normalizedValue.slice(0, lastSeparator)
      : normalizedValue
  ).replace(/[.,]/g, '');

  const decimalPart = hasDecimals
    ? normalizedValue.slice(lastSeparator + 1)
    : '';

  const cents =
    Number(integerPart) * 100 +
    Number(decimalPart.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null;
  }

  return cents;
}

export function formatCentsForInput(
  valueInCents: number,
): string {
  if (
    !Number.isFinite(valueInCents) ||
    valueInCents < 0
  ) {
    return '';
  }

  return (
    valueInCents / 100
  ).toFixed(2)
    .replace('.', ',');
}