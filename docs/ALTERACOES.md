# Registro de alterações

Entradas mais recentes no topo.

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
