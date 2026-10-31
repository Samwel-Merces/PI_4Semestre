import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { paymentService } from "./modules/payments/payment.service";

const EXPIRATION_JOB_INTERVAL_MS =
  5 * 60 * 1000;

const server = app.listen(
  env.PORT,
  () => {
    console.log(
      `Servidor rodando na porta ${env.PORT}`,
    );
  },
);

let expirationJobRunning = false;

// Libera o estoque de pedidos cujo pagamento foi abandonado.
async function runExpirationJob() {
  if (expirationJobRunning) {
    return;
  }

  expirationJobRunning = true;

  try {
    const expiredOrders =
      await paymentService.expireAbandonedCheckouts();

    if (expiredOrders > 0) {
      console.log(
        `${expiredOrders} pedido(s) com pagamento expirado cancelado(s) e estoque devolvido.`,
      );
    }
  } catch (error) {
    console.error(
      "Falha na rotina de expiração de pagamentos.",
      error,
    );
  } finally {
    expirationJobRunning = false;
  }
}

void runExpirationJob();

const expirationJob = setInterval(
  () => {
    void runExpirationJob();
  },
  EXPIRATION_JOB_INTERVAL_MS,
);

async function shutdown(
  signal: string,
) {
  console.log(
    `Sinal ${signal} recebido. Encerrando servidor...`,
  );

  clearInterval(expirationJob);

  server.close(async () => {
    await prisma.$disconnect();

    console.log(
      "Servidor encerrado com segurança.",
    );

    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
