# Registro de alterações

Entradas mais recentes no topo.

---

## 30/10/2026 — DER completo e script SQL (item 1.5 do roteiro)

### O que mudou

1. **Nova pasta `docs/banco/`** com a documentação do banco de dados:
   - `README.md`: DER em Mermaid (o GitHub desenha o diagrama), tipos enumerados, entidades, relacionamentos com a regra de exclusão de cada um, regras de integridade e o que mudou desde a primeira entrega.
   - `script.sql`: script SQL completo do banco, gerado a partir do `schema.prisma`.
   - `der.mmd`: código do DER, para gerar a imagem que vai no documento da entrega.
2. Nenhum código do app ou da API foi alterado.

### Por quê

- O roteiro (item 1.5) pede um DER com **Usuários, Agendamentos, Produtos e Serviços** e o script SQL. O DER da primeira entrega cobria só o núcleo do e-commerce (7 tabelas), sem serviços nem agendamentos, e o script SQL não estava no documento.
- O banco atual tem 11 tabelas e 8 enums. O DER novo cobre todas.

### Como foi verificado

- O `script.sql` foi executado num banco PostgreSQL 16 vazio, sem erros, e criou as 11 tabelas.
- Esse banco foi comparado com o banco criado pelas migrations (`prisma migrate diff --from-url ... --to-url ...`). Resultado: nenhuma diferença.
- As regras de exclusão da tabela de relacionamentos foram conferidas uma a uma com as chaves estrangeiras do script.

### O que o grupo precisa fazer

1. Gerar a imagem do DER (instruções em `docs/banco/README.md`) e substituir a Figura 8 do documento.
2. Atualizar no documento os quadros 17 (entidades) e 18 (relacionamentos) e as seções 6.6 e 6.7, usando o `docs/banco/README.md`. Colocar o `script.sql` como anexo.

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
