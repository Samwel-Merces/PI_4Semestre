// Valores falsos para os testes: os módulos validam o ambiente ao serem
// importados. Nenhum teste acessa o banco ou o Mercado Pago de verdade.
const defaults: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  DIRECT_URL: "postgresql://test:test@localhost:5432/test",
  JWT_SECRET: "segredo-somente-para-testes-0123456789",
  MERCADOPAGO_ACCESS_TOKEN: "TEST-token",
  MERCADOPAGO_RETURN_URL: "petshop://payment-return",
  MERCADOPAGO_WEBHOOK_SECRET: "segredo-webhook",
  MERCADOPAGO_WEBHOOK_URL: "https://example.com/payments/webhook",
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] = value;
}
