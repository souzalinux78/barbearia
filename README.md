# Barbearia Premium SaaS

Plataforma SaaS multi-tenant para barbearias, com backend Node.js + Prisma/PostgreSQL e frontend React + Vite + Tailwind.

## Stack

- Backend: Node.js, Express, Prisma, PostgreSQL, JWT, Zod, RBAC, PM2
- Frontend: React, Vite, TailwindCSS, React Router, React Query, Axios, Zustand, PWA

## Estrutura

- `backend/`: API modular (auth, billing, dashboard, crm, franchise, master, etc.)
- `frontend/`: app web mobile-first (tenant + painel master)
- `docs/`: guias operacionais e roadmap comercial

## Rodando local

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd backend && npm run build
cd frontend && npm run build
```

## PM2 (producao)

```bash
cd backend
npm run build
pm2 start ecosystem.config.js
```

## Pronto para vender (check rapido)

### 1. Criar SUPER_ADMIN (painel master)

```bash
cd backend
npm run master:create-admin -- --email master@seudominio.com --password SenhaForte123!
```

### 2. Validar prontidao de release

```bash
cd backend
npm run plans:seed
npm run release:check
```

### 3. Healthchecks

- `GET /api/v1/health`
- `GET /api/v1/health/ready`

### 4. Guias

- `docs/GO_LIVE_CHECKLIST.md`
- `docs/ROADMAP_PRODUTO_VENDAVEL.md`
