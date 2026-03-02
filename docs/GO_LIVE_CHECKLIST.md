# Go-Live Checklist (Venda e Producao)

## 1. Infraestrutura

- Provisionar PostgreSQL dedicado com backup automatico diario.
- Definir ambiente `production` para backend e frontend.
- Configurar HTTPS (TLS) no dominio principal.
- Configurar `CORS_ORIGIN` com dominio real do frontend.

## 2. Banco e migracoes

- Rodar `npm run prisma:generate` no backend.
- Rodar `npm run prisma:deploy` no backend.
- Rodar `npm run release:check` no backend.
- Validar `GET /api/v1/health/ready` retornando `200`.

## 3. Credenciais obrigatorias

- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` fortes.
- `MASTER_JWT_SECRET` forte e exclusivo.
- Stripe e/ou PIX configurados (global e/ou por tenant).
- Chaves VAPID para push notification.

## 4. Conta Master

- Criar SUPER_ADMIN:
  - `npm run master:create-admin -- --email master@seudominio.com --password SenhaForte123!`
- Testar login em `/admin/login`.
- Validar menu Master completo: Dashboard, Metricas, Receita, Churn, Alertas, Cobranca, Tenants.

## 5. Fluxo comercial completo (obrigatorio)

- Testar cadastro de barbearia em `/register`.
- Escolher plano e gateway no cadastro.
- Gerar cobranca e concluir pagamento.
- Confirmar atualizacao da assinatura para `ACTIVE`.
- Validar bloqueio automatico para `PAST_DUE`.

## 6. Operacao interna

- Criar 1 tenant demo com dados reais de exemplo.
- Cadastrar servicos, equipe, clientes e agendamentos de teste.
- Testar dashboard, financeiro, CRM e automacao.

## 7. Suporte e monitoramento

- Coletar logs backend em arquivo/stack centralizada.
- Monitorar endpoints:
  - `/api/v1/health`
  - `/api/v1/health/ready`
- Definir rotina de resposta para falha de webhook.

## 8. Politicas para vender com seguranca

- Termos de uso e politica de privacidade publicados.
- Fluxo de cancelamento e reembolso definido.
- Canal de suporte (WhatsApp, e-mail ou portal).
- SLA inicial de atendimento (ex.: ate 24h em horario comercial).

