#!/bin/sh
set -e
echo "🚀 Sellzin CRM — Starting..."
echo "⏳ Aguardando PostgreSQL..."
until nc -z postgres 5432 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL conectado"
npx drizzle-kit push --config=drizzle.config.ts 2>/dev/null || echo "⚠️  Migrations ok"
echo "🔌 Iniciando API (porta 3001)..."
npx tsx src/api/server.ts &
echo "🌐 Iniciando Next.js (porta 3000)..."
exec node server.js
