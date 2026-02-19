#!/bin/sh
set -e

echo "🚀 Sellzin CRM — Starting..."

# Wait for DB
echo "⏳ Aguardando PostgreSQL..."
until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL conectado"

# Run migrations
echo "📦 Executando migrations..."
npx drizzle-kit push 2>/dev/null || echo "⚠️  Migrations já aplicadas ou não encontradas"

# Start workers (background)
echo "🔄 Iniciando workers..."
node src/api/workers.js &

# Start API server (background)
echo "🔌 Iniciando API (porta 3001)..."
node src/api/server.js &

# Start Next.js
echo "🌐 Iniciando Next.js (porta 3000)..."
exec node server.js
