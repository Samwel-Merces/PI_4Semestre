import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OrderStatus } from "@prisma/client";

import { AppError } from "../../../shared/errors/AppError";

import { OrderContext } from "./order-context";
import type { OrderStore } from "./order-context";
import type { OrderAction } from "./order-state";

function setup(status: OrderStatus) {
  const stock = new Map<string, number>([
    ["p1", 10],
    ["p2", 5],
  ]);
  const statuses: OrderStatus[] = [];

  const store: OrderStore = {
    async updateOrderStatus(_id, next) {
      statuses.push(next);
    },
    async incrementProductStock(productId, quantity) {
      stock.set(productId, (stock.get(productId) ?? 0) + quantity);
    },
  };

  const context = new OrderContext(store, {
    id: "o1",
    status,
    items: [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ],
  });

  return { context, stock, statuses };
}

async function assertConflict(promise: Promise<void>) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, "INVALID_ORDER_STATUS_TRANSITION");
    return true;
  });
}

describe("OrderContext (padrão State)", () => {
  it("CONFIRMED -> PROCESSING sem mexer no estoque", async () => {
    const { context, stock, statuses } = setup("CONFIRMED");

    await context.process();

    assert.equal(context.status, "PROCESSING");
    assert.deepEqual(statuses, ["PROCESSING"]);
    assert.equal(stock.get("p1"), 10);
  });

  it("PROCESSING -> COMPLETED", async () => {
    const { context, statuses } = setup("PROCESSING");

    await context.complete();

    assert.equal(context.status, "COMPLETED");
    assert.deepEqual(statuses, ["COMPLETED"]);
  });

  for (const status of ["CONFIRMED", "PROCESSING"] as const) {
    it(`cancelar ${status} devolve o estoque`, async () => {
      const { context, stock, statuses } = setup(status);

      await context.cancel();

      assert.equal(context.status, "CANCELLED");
      assert.deepEqual(statuses, ["CANCELLED"]);
      assert.equal(stock.get("p1"), 12);
      assert.equal(stock.get("p2"), 6);
    });
  }

  it("CONFIRMED não pode ser concluído direto", async () => {
    const { context, statuses } = setup("CONFIRMED");

    await assertConflict(context.complete());

    assert.equal(context.status, "CONFIRMED");
    assert.deepEqual(statuses, []);
  });

  it("PROCESSING não volta para PROCESSING", async () => {
    const { context } = setup("PROCESSING");

    await assertConflict(context.process());
  });

  const actions: OrderAction[] = ["process", "complete", "cancel"];

  for (const status of [
    "COMPLETED",
    "CANCELLED",
    "PENDING_PAYMENT",
  ] as const) {
    for (const action of actions) {
      it(`${status} rejeita "${action}" (409) sem alterar nada`, async () => {
        const { context, stock, statuses } = setup(status);

        await assertConflict(context.perform(action));

        assert.deepEqual(statuses, []);
        assert.equal(stock.get("p1"), 10);
      });
    }
  }

  it("cancelar duas vezes não devolve o estoque em dobro", async () => {
    const { context, stock } = setup("CONFIRMED");

    await context.cancel();
    await assertConflict(context.cancel());

    assert.equal(stock.get("p1"), 12);
  });
});
