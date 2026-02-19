import { db } from "../lib/db";
import { contacts } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

interface RFMScores {
  recency: number;
  frequency: number;
  monetary: number;
  score: number;
  segment: string;
}

export async function calculateRFM(tenantId: string) {
  console.log(`[rfm] Calculating RFM for tenant ${tenantId}`);

  // Get all contacts with order data
  const allContacts = await db.query.contacts.findMany({
    where: eq(contacts.tenantId, tenantId),
    columns: { id: true, lastOrderAt: true, totalOrders: true, totalSpent: true },
  });

  if (allContacts.length === 0) return;

  // Calculate quintiles
  const now = new Date();
  const recencies = allContacts
    .filter(c => c.lastOrderAt)
    .map(c => Math.floor((now.getTime() - new Date(c.lastOrderAt!).getTime()) / 86400000));
  const frequencies = allContacts.map(c => c.totalOrders || 0);
  const monetaries = allContacts.map(c => parseFloat(String(c.totalSpent || "0")));

  const getQuintile = (arr: number[], value: number): number => {
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length === 0) return 3;
    const idx = sorted.indexOf(value);
    const pct = idx / sorted.length;
    if (pct <= 0.2) return 1;
    if (pct <= 0.4) return 2;
    if (pct <= 0.6) return 3;
    if (pct <= 0.8) return 4;
    return 5;
  };

  // Update each contact
  for (const contact of allContacts) {
    const daysSinceOrder = contact.lastOrderAt
      ? Math.floor((now.getTime() - new Date(contact.lastOrderAt).getTime()) / 86400000) : 999;

    const r = contact.lastOrderAt ? (6 - getQuintile(recencies, daysSinceOrder)) : 1; // Invert: lower days = higher score
    const f = getQuintile(frequencies, contact.totalOrders || 0);
    const m = getQuintile(monetaries, parseFloat(String(contact.totalSpent || "0")));
    const score = ((r + f + m) / 3);
    const segment = getSegment(r, f, m);

    await db.update(contacts).set({
      rfmRecency: r,
      rfmFrequency: f,
      rfmMonetary: m,
      rfmScore: score.toFixed(2),
      rfmSegment: segment,
      updatedAt: new Date(),
    }).where(eq(contacts.id, contact.id));
  }

  console.log(`[rfm] Updated ${allContacts.length} contacts`);
}

function getSegment(r: number, f: number, m: number): string {
  const avg = (r + f + m) / 3;

  if (r >= 4 && f >= 4 && m >= 4) return "champions";
  if (f >= 4 && m >= 3) return "loyal";
  if (r >= 4 && f <= 2) return "new_customers";
  if (r >= 3 && f >= 2 && avg >= 3) return "potential";
  if (r <= 2 && f >= 3) return "at_risk";
  if (r <= 2 && f >= 4 && m >= 4) return "cant_lose";
  if (r <= 2 && f <= 2) return "lost";
  return "hibernating";
}

// Run periodically (called by cron or manually)
export async function runRFMForAllTenants() {
  const { tenants } = await import("../lib/db/schema");
  const allTenants = await db.query.tenants.findMany({
    where: eq(tenants.isActive, true),
    columns: { id: true },
  });

  for (const tenant of allTenants) {
    await calculateRFM(tenant.id);
  }
}
