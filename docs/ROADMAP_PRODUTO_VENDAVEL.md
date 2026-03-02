# Roadmap Produto Vendavel (90 dias)

## Sprint 1 (0-14 dias): Estabilidade e cobranca confiavel

- Fechar erros de tela branca (ErrorBoundary + cache PWA controlado em dev).
- Congelar schema e migracoes para ambiente novo sem erro manual.
- Validar Stripe/PIX com webhooks e status de assinatura.
- Garantir onboarding real:
  - landing -> cadastro -> plano -> pagamento -> acesso.

Critério de aceite:
- 0 erro P0 aberto em fluxo de cadastro e assinatura.
- `release:check` sem `FAIL`.

## Sprint 2 (15-30 dias): Operacao da barbearia

- CRUD completo e validado de:
  - usuarios
  - servicos
  - clientes
  - agenda
- Financeiro com conciliacao basica.
- Regras de permissao por papel revisadas (RBAC).

Critério de aceite:
- Owner consegue operar 100% sem SQL manual.
- Barber e Reception sem acesso indevido.

## Sprint 3 (31-60 dias): Escala comercial

- Fluxo de trial e conversao com comunicao automatica.
- Dashboard Master com alertas acionaveis.
- Onboarding guiado com checklist inicial no app.
- Pagina de planos com prova social e FAQ.

Critério de aceite:
- Primeira venda concluida ponta a ponta.
- Tempo de ativacao de novo cliente < 20 minutos.

## Sprint 4 (61-90 dias): Confianca de mercado

- Observabilidade (logs, metricas, alertas).
- Backup/restore testado.
- Auditoria de acoes sensiveis (billing, status de tenant, impersonacao).
- Documentacao de suporte e base de conhecimento.

Critério de aceite:
- Operacao estavel por 30 dias sem incidente critico.

