import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import { CheckoutFacade } from "./checkout.facade";
import type { PendingCheckout } from "./checkout.types";

const pending = {
  payment: { id: "pay1", externalReference: "payment_x" },
  order: { id: "order1" },
} as unknown as PendingCheckout;

function writeConflict() {
  return new Prisma.PrismaClientKnownRequestError("conflito", {
    code: "P2034",
    clientVersion: "test",
  });
}

function setup(reserve: () => Promise<PendingCheckout>) {
  const calls = { reserve: 0, payments: 0 };

  const facade = new CheckoutFacade(
    async () => {
      calls.reserve += 1;
      return reserve();
    },
    {
      async startPayment(checkout) {
        calls.payments += 1;
        return {
          paymentId: checkout.payment.id,
          orderId: checkout.order.id,
          initPoint: "https://mp.test/pagar",
        };
      },
    },
  );

  return { facade, calls };
}

describe("CheckoutFacade (padrão Facade)", () => {
  it("reserva o pedido e inicia o pagamento", async () => {
    const { facade, calls } = setup(async () => pending);

    const result = await facade.checkout("user1");

    assert.deepEqual(result, {
      paymentId: "pay1",
      orderId: "order1",
      initPoint: "https://mp.test/pagar",
    });
    assert.deepEqual(calls, { reserve: 1, payments: 1 });
  });

  it("repete a reserva quando há conflito de escrita (P2034)", async () => {
    let failures = 2;
    const { facade, calls } = setup(async () => {
      if (failures > 0) {
        failures -= 1;
        throw writeConflict();
      }
      return pending;
    });

    await facade.checkout("user1");

    assert.equal(calls.reserve, 3);
    assert.equal(calls.payments, 1);
  });

  it("desiste depois de 3 conflitos e não chama o pagamento", async () => {
    const { facade, calls } = setup(async () => {
      throw writeConflict();
    });

    await assert.rejects(facade.checkout("user1"));

    assert.equal(calls.reserve, 3);
    assert.equal(calls.payments, 0);
  });

  it("outros erros (ex.: carrinho vazio) não são repetidos", async () => {
    const { facade, calls } = setup(async () => {
      throw new Error("carrinho vazio");
    });

    await assert.rejects(facade.checkout("user1"), /carrinho vazio/);

    assert.equal(calls.reserve, 1);
    assert.equal(calls.payments, 0);
  });
});
