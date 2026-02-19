# Sellzin — CRM para E-commerce

CRM inteligente para e-commerce brasileiro. WooCommerce & Magento em um só painel, com automação de WhatsApp e assistente IA.

## Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **API:** Fastify + Drizzle ORM
- **Banco:** PostgreSQL 16
- **Cache/Filas:** Redis 7 + BullMQ
- **WhatsApp:** Evolution API (self-hosted)
- **Deploy:** Docker + Portainer

## Estrutura do Projeto

```
sellzin/
├── docker/
│   ├── Dockerfile          # Build multi-stage
│   └── entrypoint.sh       # Startup com migrations
├── src/
│   ├── api/
│   │   ├── server.ts       # Fastify API (porta 3001)
│   │   └── routes/
│   │       ├── auth.ts      # Register, Login, Me
│   │       ├── stores.ts    # CRUD de lojas
│   │       ├── contacts.ts  # Contatos + RFM + busca
│   │       ├── orders.ts    # Pedidos + stats
│   │       ├── carts.ts     # Carrinhos abandonados
│   │       ├── campaigns.ts # Campanhas + disparo rápido
│   │       ├── analytics.ts # Dashboard + métricas
│   │       └── webhooks.ts  # Recebe webhooks WC/Magento
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── dashboard/
│   └── lib/
│       ├── db/
│       │   ├── index.ts     # Conexão PostgreSQL
│       │   └── schema.ts    # Schema completo (Drizzle)
│       ├── redis.ts         # Conexão Redis
│       └── queues.ts        # BullMQ queues
├── scripts/
│   └── init-db.sql          # Extensões PostgreSQL
├── docker-compose.yml       # Stack completa
├── .env.example             # Template de variáveis
├── drizzle.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

## Deploy no Portainer

### 1. Preparar o servidor

```bash
# Clonar o repositório
git clone <repo-url> /opt/sellzin
cd /opt/sellzin

# Criar .env a partir do template
cp .env.example .env
nano .env  # Ajustar variáveis (JWT_SECRET, senhas, etc)
```

### 2. Via Portainer (Recomendado)

1. Acesse o Portainer
2. Vá em **Stacks → Add Stack**
3. Escolha **Upload** e envie o `docker-compose.yml`
4. Ou escolha **Repository** e aponte para o repo Git
5. Em **Environment variables**, adicione as variáveis do `.env`
6. Clique **Deploy the stack**

### 3. Via CLI (Alternativa)

```bash
cd /opt/sellzin
docker compose up -d

# Acompanhar logs
docker compose logs -f app

# Ver status
docker compose ps
```

### 4. Verificar

```bash
# Health check da API
curl http://localhost:3001/health

# Acessar o painel
# http://localhost:3000
```

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Subir PostgreSQL e Redis
docker compose up -d postgres redis

# Rodar migrations
npm run db:push

# Iniciar dev (Next.js + API)
npm run dev
```

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `APP_PORT` | Porta do Next.js | 3000 |
| `API_PORT` | Porta da API Fastify | 3001 |
| `JWT_SECRET` | Chave para tokens JWT | — |
| `DATABASE_URL` | Connection string PostgreSQL | — |
| `REDIS_URL` | Connection string Redis | — |
| `POSTGRES_USER` | Usuário do PostgreSQL | sellzin |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | — |
| `POSTGRES_DB` | Nome do banco | sellzin |
| `EVOLUTION_API_URL` | URL da Evolution API | — |
| `EVOLUTION_API_KEY` | Chave da Evolution API | — |

## Portas

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| Next.js | 3000 | Frontend / Dashboard |
| Fastify | 3001 | API REST |
| PostgreSQL | 5432 | Banco de dados |
| Redis | 6379 | Cache e filas |
| Bull Board | 3002 | Monitor de filas (opcional) |

## API Endpoints

Base: `http://localhost:3001/v1`

- `POST /auth/register` — Criar conta
- `POST /auth/login` — Login
- `GET /auth/me` — Dados do tenant
- `POST /stores` — Conectar loja
- `GET /contacts` — Listar contatos
- `GET /contacts/stats` — Estatísticas
- `GET /contacts/segments` — Segmentos RFM
- `GET /orders` — Listar pedidos
- `GET /orders/stats` — Faturamento
- `GET /carts/abandoned` — Carrinhos abandonados
- `POST /carts/abandoned/recover` — Disparar recuperação
- `POST /campaigns` — Criar campanha
- `GET /analytics/overview` — Dashboard geral
- `POST /webhooks/woocommerce/:storeId` — Webhook WC
- `POST /webhooks/magento/:storeId` — Webhook Magento
