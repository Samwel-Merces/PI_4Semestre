import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toGatewayPayment } from "./mercado-pago.adapter";

describe("MercadoPagoAdapter", () => {
  it("traduz a resposta do Mercado Pago para o formato do PetShop", () => {
    const payment = toGatewayPayment({
      id: 123456,
      external_reference: "payment_abc",
      transaction_amount: 59.9,
      status: "approved",
    });

    assert.deepEqual(payment, {
      id: "123456",
      externalReference: "payment_abc",
      amount: 59.9,
      status: "approved",
    });
  });

  it("mantém campos ausentes como indefinidos", () => {
    const payment = toGatewayPayment({ id: "9" });

    assert.equal(payment.id, "9");
    assert.equal(payment.externalReference, undefined);
    assert.equal(payment.amount, undefined);
    assert.equal(payment.status, undefined);
  });
});
