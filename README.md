# Barbearia Premium SaaS

Base completa de um SaaS multi-tenant para barbearias masculinas, com backend Node.js + Prisma/PostgreSQL e frontend React + Vite + Tailwind.

## Stack

- Backend: Node.js, Express, Prisma, PostgreSQL, JWT (access/refresh), Zod, RBAC, PM2
- Frontend: React, Vite, TailwindCSS, React Router, React Query, Axios, Zustand, PWA

## Estrutura

- `backend/`: API modular, segurança, autenticação, autorização, módulos de negócio
- `frontend/`: App mobile-first com navegação inferior no mobile e sidebar no desktop

## Como rodar

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Build produção

```bash
cd backend && npm run build
cd frontend && npm run build
```

## PM2 (produção)

```bash
cd backend
npm run build
pm2 start ecosystem.config.js
```
