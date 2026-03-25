-- Migration: WhatsApp Channels
-- Execute na VPS: docker exec -i sellzin-postgres psql -U sellzin -d sellzin < scripts/migrate-whatsapp.sql

DO $$ BEGIN
  CREATE TYPE whatsapp_provider AS ENUM ('evolution', 'official');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_status AS ENUM ('disconnected', 'connecting', 'connected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS whatsapp_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  provider whatsapp_provider NOT NULL,
  -- Evolution API
  instance_name VARCHAR(255),
  evolution_url VARCHAR(500),
  evolution_key VARCHAR(255),
  -- WhatsApp Business API (Official)
  phone_number_id VARCHAR(100),
  access_token TEXT,
  verify_token VARCHAR(255),
  business_account_id VARCHAR(100),
  -- Status
  status whatsapp_status NOT NULL DEFAULT 'disconnected',
  phone_number VARCHAR(50),
  qr_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_channels_tenant_idx ON whatsapp_channels(tenant_id);

SELECT 'Migration whatsapp_channels concluída.' AS result;
