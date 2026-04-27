-- Automation runs table for tracking execution history
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  contact_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  current_step INTEGER NOT NULL DEFAULT 0,
  context JSONB DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS automation_runs_tenant_idx ON automation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS automation_runs_automation_idx ON automation_runs(automation_id);
