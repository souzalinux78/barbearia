# Backend

## Master Admin (SUPER_ADMIN)

O login master (`/admin/login`) nao faz mais bootstrap automatico por `.env`.
O usuario master deve ser criado/atualizado diretamente no banco com comando explicito:

```bash
npm run master:create-admin -- --email master@barbeariapremium.com --password SuaSenhaForte123!
```

Se o e-mail ja existir em `saas_admins`, a senha sera atualizada.

## Release readiness

Antes de subir em producao:

```bash
npm run plans:seed
npm run release:check
```

Esse comando valida:

- conexao com banco
- existencia de tabelas criticas
- catalogo de planos
- existencia de admin master
- segredos essenciais

## Healthcheck de prontidao

- `GET /api/v1/health`
- `GET /api/v1/health/ready`

## Cobranca automatica (lifecycle)

- O backend executa sweep automatico de billing (trial expirado, renovacao PIX e cancelamento ao fim do periodo).
- Endpoint manual para suporte:
  - `POST /api/v1/billing/run-lifecycle-sweep` (OWNER/ADMIN/UNIT_OWNER/UNIT_ADMIN)
