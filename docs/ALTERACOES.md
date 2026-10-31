# Registro de alterações

Entradas mais recentes no topo.

---

## 31/10/2026 — Verificação, retomada e expiração de pagamentos

### O que mudou

1. **Verificação do pagamento sem depender do webhook.**
   - Nova rota `POST /payments/orders/:orderId/sync` (cliente logado, só os próprios pedidos). Busca no Mercado Pago os pagamentos pendentes do pedido pela referência externa e aplica as mesmas regras do webhook.
   - A lógica do webhook foi separada no método `applyProviderPayment`, usado pelo webhook e pela verificação.
   - No app, ao abrir um pedido "Aguardando pagamento", a verificação roda sozinha. A tela também mostra um aviso e o botão **"Verificar pagamento"**.
2. **Retomar o pagamento.**
   - Nova rota `POST /payments/orders/:orderId/resume`. Confere o pagamento antes, para não cobrar de novo um pedido que já foi pago, e devolve o link do Mercado Pago do pedido.
   - Recusa com 409 se o pedido não está aguardando pagamento ou se o prazo passou.
   - No app, botão **"Pagar agora"** no pedido pendente. Ao voltar do Mercado Pago, o pedido é recarregado e verificado.
3. **Expiração de pedidos abandonados.**
   - O link de pagamento expira em 30 minutos (`expires` e `expiration_date_to` na preferência).
   - Uma rotina roda ao ligar a API e a cada 5 minutos (`server.ts`). Para pedidos "Aguardando pagamento" com mais de 35 minutos, ela confere no Mercado Pago e, se não houver nenhuma tentativa de pagamento, cancela o pedido e devolve o estoque. O pagamento fica com `providerStatus` igual a `expired`.
   - Pedidos com pagamento em andamento no Mercado Pago (ex.: boleto em aberto) não são cancelados. O webhook resolve.
   - O cancelamento usa o mesmo método do checkout que falha ao criar a preferência (`cancelPendingPayment`). O estoque só volta se o pedido ainda estava aguardando pagamento.
4. **App:** a abertura da página do Mercado Pago foi para `utils/openPaymentPage.ts`, usada pelo checkout e pelo detalhe do pedido.

### Arquivos

| Arquivo | Alteração |
| --- | --- |
| `backend/src/modules/payments/payment.service.ts` | `synchronizeOrderPayment`, `resumeOrderPayment`, `expireAbandonedCheckouts`, `applyProviderPayment`, `cancelPendingPayment`; expiração na preferência |
| `backend/src/modules/payments/payment.controller.ts` | Ações `syncOrderPayment` e `resumeOrderPayment` |
| `backend/src/modules/payments/payment.routes.ts` | Rotas `/orders/:orderId/sync` e `/orders/:orderId/resume` |
| `backend/src/server.ts` | Rotina de expiração a cada 5 minutos, parada no encerramento |
| `mobile/src/utils/openPaymentPage.ts` | **Novo** — abre o Mercado Pago (web ou celular) |
| `mobile/src/services/payment.service.ts` | `syncOrderPayment` e `resumeOrderPayment` |
| `mobile/src/hooks/useCheckout.ts` | Usa `openPaymentPage` |
| `mobile/src/hooks/useOrderDetails.ts` | Verificação automática, `checkPayment` e `resumePayment` |
| `mobile/src/screens/OrderDetailsScreen.tsx` | Cartão de pagamento pendente com "Pagar agora" e "Verificar pagamento" |

### Como foi testado

- **Webhook perdido:** um pedido pago foi voltado no banco para "Aguardando pagamento". A verificação (pela rota e ao abrir o pedido no app) o devolveu para Confirmado/Aprovado.
- **Rota de verificação:** pedido sem pagamento continua pendente (200); pedido confirmado não muda (200); pedido de outro usuário dá 404; ID inválido dá 400; sem login dá 401.
- **Retomar:** pedido pendente devolve o link (200); pedido pago dá 409; pedido criado com outro token do Mercado Pago dá 502 com mensagem clara. No app, "Pagar agora" abriu o Mercado Pago, o pagamento foi feito com o comprador de teste e o pedido voltou como Confirmado.
- **Expiração:** na primeira execução, a rotina cancelou os 4 pedidos abandonados e devolveu o estoque; os pedidos pagos não mudaram. Um checkout novo com prazo de validade foi aceito pelo Mercado Pago.
- `npx tsc --noEmit` sem erros no backend e no mobile; `npm run audit:a11y` sem problemas.

### Pendências

- Na versão web, o retorno do Mercado Pago (`petshop://payment-return`) não abre o app. O cliente precisa fechar a aba do Mercado Pago e voltar para a aba do app.
- Se o webhook de um pagamento aprovado chegar depois que a rotina cancelou o pedido, o pagamento fica Aprovado e o pedido continua Cancelado. A expiração do link (30 minutos) e a folga de 5 minutos tornam isso improvável, mas o caso não é tratado.

---

## 31/10/2026 — Correções no pagamento pelo Mercado Pago

### O que mudou

1. **O e-mail do cliente não é mais enviado na preferência de pagamento.**
   Com credenciais de teste, o e-mail `cliente@example.com` não pertence a nenhum usuário de teste, e o Mercado Pago recusava o pagamento com "Uma das partes com as quais você está tentando efetuar o pagamento é de teste". Agora só o nome vai em `payer`. O cliente informa o e-mail na página do Mercado Pago.
2. **A URL de notificação recebe `?source_news=webhooks`.**
   Sem esse parâmetro, o Mercado Pago enviava, além do webhook, notificações no formato IPN antigo (`?id=...&topic=payment` e `?id=...&topic=merchant_order`). Essas notificações não passam na validação de assinatura, eram recusadas com 401 e o Mercado Pago as reenviava várias vezes. O pedido era confirmado normalmente pelo webhook, mas o log ficava cheio de recusas.
3. **O log de webhook recusado ficou mais completo.**
   Agora mostra o tipo da notificação, o motivo da recusa dado pelo SDK (`reason`) e os nomes dos parâmetros da URL. Nenhum segredo ou valor de assinatura é registrado.

### Arquivos

| Arquivo | Alteração |
| --- | --- |
| `backend/src/modules/payments/payment.service.ts` | `payer` sem e-mail; novo método `buildNotificationUrl` |
| `backend/src/modules/payments/payment.controller.ts` | Campos `type`, `action`, `reason` e `queryKeys` no log de recusa |
| `docs/ALTERACOES.md` | Esta entrada |

### Como foi testado

Compras de teste pelo app web, com vendedor e comprador de teste do Mercado Pago e webhook exposto por um túnel (cloudflared):

- Antes da correção 1: o checkout do Mercado Pago mostrava o erro "uma das partes é de teste".
- Depois da correção 1: pagamento aprovado e pedido `CONFIRMED`, mas com 6 notificações IPN recusadas por `SignatureMismatch`.
- Depois da correção 2: pagamento aprovado, pedido `CONFIRMED` e **nenhuma notificação recusada** para a compra nova.
- `npx tsc --noEmit` no backend: sem erros.

### Como configurar o Mercado Pago para testar

1. Em **Contas de teste** (painel de desenvolvedor), criar um **vendedor** e um **comprador** de teste.
2. Entrar como **vendedor de teste** numa janela anônima e copiar o Access Token de **Credenciais de produção** da aplicação dele. Como a conta é de teste, nenhum dinheiro real é movimentado.
3. Nessa aplicação, configurar o **Webhook** (evento Pagamentos) com uma URL pública que aponte para `/payments/webhook`, por exemplo com `cloudflared tunnel --url http://localhost:3000`, e copiar a assinatura secreta.
4. Preencher no `backend/.env`: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e `MERCADOPAGO_WEBHOOK_URL`.
5. Pagar numa **nova janela anônima**, entrando com o **comprador de teste**. Cartão Mastercard `5480 8328 0103 3311`, nome `APRO`, validade `11/30`, CVV `123`, CPF `12345678909`.

### Pendências

- Se o webhook não chegar, o pedido fica em "Aguardando pagamento" para sempre. Não há verificação do pagamento quando o cliente volta para o app.
- Pedidos abandonados em "Aguardando pagamento" seguram o estoque, e o admin não consegue cancelá-los.
- O app não permite retomar o pagamento de um pedido pendente.
- Na versão web, o retorno do Mercado Pago (`petshop://payment-return`) não abre o app.

---

## 18/10/2026 — Remoção de `POST /orders`, seed de demonstração e README

### O que mudou

1. **Rota `POST /orders` removida.**
   Essa rota criava pedidos direto do carrinho, sem passar pelo Mercado Pago. Nenhuma tela do app usava essa rota. O único jeito de fechar uma compra agora é `POST /payments/checkout`, que já era o caminho usado pelo app.
   - Saíram a rota, o método `create` do controller e os métodos `create` e `executeCheckout` do service de pedidos.
   - No app, saiu o método `create()` de `orderService`. Nenhum hook ou tela chamava esse método.
   - As rotas de consulta (`GET /orders`, `GET /orders/:id`) e as rotas do admin (`/orders/admin...`) continuam iguais.

2. **Seed de dados de demonstração (`backend/prisma/seed.ts`).**
   Preenche o banco com dados de exemplo para testar e apresentar o app:
   - 1 administrador e 1 cliente;
   - 10 produtos de todas as categorias, para cão, gato, outros animais e "todas as espécies";
   - 3 serviços (Banho, Tosa Higiênica e Banho e Tosa Completa), com preço por porte P/M/G;
   - 2 pets do cliente (Thor, cão porte M; Mia, gata porte P);
   - 4 pedidos do cliente, um em cada status: Confirmado, Em processamento, Concluído e Cancelado. Cada pedido tem seus itens e um pagamento.

   Como o seed funciona:
   - Pode ser rodado mais de uma vez. Usa identificadores fixos e "cria ou atualiza" em vez de "cria sempre". Usuários são identificados pelo e-mail e o resto por IDs fixos no próprio arquivo.
   - Senhas são gravadas com bcrypt custo 12, igual ao cadastro do app.
   - Os itens do pedido guardam nome, imagem e preço do produto no momento da compra, e o total do pedido é a soma dos itens.
   - O valor do pagamento é igual ao total do pedido. O código de referência (`externalReference`) é único e segue o formato do checkout.
   - Pedidos Confirmado, Em processamento e Concluído têm pagamento **aprovado**. O pedido Cancelado tem pagamento **recusado**. É o mesmo estado que o webhook do Mercado Pago deixaria.
   - Na primeira execução, o estoque de cada produto já desconta as unidades dos pedidos não cancelados. O pedido cancelado não consome estoque.
   - Nas execuções seguintes, o seed **não mexe** no estoque, no status ativo dos produtos, nas senhas nem nos pedidos. Assim não desconta estoque duas vezes e não desfaz o que alguém alterou pelo app.

3. **README atualizado.**
   - Passo a passo completo: subir o banco, rodar migrations, rodar o seed, iniciar backend e app.
   - Nova seção com as credenciais de demonstração.
   - Nova seção "Limitações conhecidas", explicando o problema da recuperação de senha (ver Pendências).

4. **Comentário `TODO` no forgot-password.**
   Em `backend/src/modules/auth/auth.service.ts`, método `forgotPassword`, foram adicionadas **só linhas de comentário**. O comportamento não mudou.

### Por quê

- `POST /orders` era uma forma de fechar compra sem pagamento, paralela ao checkout real. Não era usada e deixava aberta uma porta para criar pedidos "confirmados" sem pagar.
- Sem o seed, cada integrante precisava cadastrar produtos, serviços e pedidos à mão para testar ou apresentar.
- O README antigo mandava criar só o arquivo `.env`, mas o `docker-compose.yml` lê o `.env.local`. Seguindo o README antigo, o banco não subia.

### Arquivos

| Arquivo | Alteração |
| --- | --- |
| `backend/src/modules/orders/order.routes.ts` | Removida a rota `POST /` |
| `backend/src/modules/orders/order.controller.ts` | Removido o método `create` |
| `backend/src/modules/orders/order.service.ts` | Removidos `create` e `executeCheckout` |
| `mobile/src/services/order.service.ts` | Removido o método `create()` |
| `backend/prisma/seed.ts` | **Novo** — seed de demonstração |
| `backend/package.json` | Configuração `"prisma": { "seed": ... }` e script `npm run db:seed` |
| `backend/.env.example` | Variáveis `SEED_ADMIN_PASSWORD` e `SEED_CLIENT_PASSWORD` |
| `README.md` | Passo a passo, credenciais de demonstração e limitações conhecidas |
| `backend/src/modules/auth/auth.service.ts` | Só um comentário `TODO` no `forgotPassword` |
| `docs/ALTERACOES.md` | **Novo** — este arquivo |

### Como testar

**Verificação de tipos.** Esta foi feita e passou sem erros em `backend/`, em `mobile/` e na checagem avulsa do `prisma/seed.ts`:

```bash
cd backend && npx tsc --noEmit
cd mobile && npx tsc --noEmit
```

O `tsconfig.json` do backend só olha a pasta `src/`, então o `npx tsc --noEmit` do backend **não** verifica o `prisma/seed.ts`. A checagem do seed foi feita à parte.

**Seed.** **Ainda não foi testado num banco real** (ver Pendências). Para testar:

```bash
cd backend
npx prisma migrate deploy
npm run db:seed   # deve terminar com "Seed concluído." e as contagens
npm run db:seed   # rodar de novo: as contagens devem ser as mesmas
```

Depois, entrar no app com as credenciais do README:
- **Cliente:** deve ver 2 pets e 4 pedidos, um em cada status.
- **Admin:** deve ver os 4 pedidos, os 10 produtos e os 3 serviços.

**Remoção de `POST /orders`:**
- Uma chamada autenticada para `POST /orders` não deve mais criar pedido.
- O checkout pelo Mercado Pago (`POST /payments/checkout`) e a lista de pedidos do app continuam funcionando.

O teste de `POST /orders` com a API rodando **não foi feito**. Foi verificado apenas que nenhum código do app ou do backend chama o método removido.

### O que o grupo precisa fazer

1. **Rodar o seed num banco de verdade** e confirmar que ele termina sem erro e que rodar de novo não duplica dados. Esse teste ainda não foi feito.
2. **Criar o `backend/.env.local`** além do `.env` (`cp .env .env.local`), se for usar o banco pelo Docker. O README já explica.
3. **Decidir sobre as senhas de demonstração.** As senhas padrão (`Admin@123` e `Cliente@123`) estão escritas no README. Se o banco ficar acessível para outras pessoas, troquem as senhas pelas variáveis `SEED_ADMIN_PASSWORD` e `SEED_CLIENT_PASSWORD` antes de rodar o seed.
4. **Não usar o projeto em produção** enquanto a pendência abaixo não for resolvida.

### Pendências e decisões adiadas

- **Recuperação de senha devolve o token na resposta (não corrigido de propósito).**
  - Hoje `POST /auth/forgot-password` retorna o token de redefinição na própria resposta da API, porque o projeto não envia e-mail.
  - Na prática, quem souber o e-mail de uma conta consegue redefinir a senha dela.
  - Foi decidido **não alterar** esse fluxo agora. Só foram registrados um `TODO` no código e um aviso no README.
  - Para corrigir: enviar o token por e-mail e fazer a API responder só com a mensagem genérica.
- **Seed não executado contra um banco.** Na máquina onde as alterações foram feitas não havia Docker nem `.env` configurado, então o seed não rodou contra um banco. Foi verificado só que o comando `npm run db:seed` é encontrado, compila o arquivo e encerra com erro quando não há banco disponível (em vez de travar).
- **Pagamentos de exemplo sem IDs do Mercado Pago.** Nos pedidos do seed, `preferenceId` e `providerPaymentId` ficam vazios, porque não existe pagamento real correspondente. Esses pedidos servem só para visualização. Não dá para conferi-los no painel do Mercado Pago.
