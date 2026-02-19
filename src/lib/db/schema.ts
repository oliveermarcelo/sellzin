// @ts-nocheck
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──

export const planEnum = pgEnum("plan", ["starter", "growth", "enterprise"]);
export const platformEnum = pgEnum("platform", ["woocommerce", "magento"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
export const rfmSegmentEnum = pgEnum("rfm_segment", [
  "champions",
  "loyal",
  "potential",
  "new_customers",
  "at_risk",
  "cant_lose",
  "hibernating",
  "lost",
]);
export const channelEnum = pgEnum("channel", [
  "whatsapp",
  "email",
  "sms",
  "telegram",
  "manual",
  "assistant",
  "openclaw",
]);
export const automationTriggerEnum = pgEnum("automation_trigger", [
  "cart_abandoned",
  "order_placed",
  "order_shipped",
  "order_delivered",
  "customer_created",
  "customer_birthday",
  "rfm_segment_change",
  "nps_response",
  "manual",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
]);

// ── Tenants (Contas) ──

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plan: planEnum("plan").notNull().default("starter"),
  apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
  settings: jsonb("settings").default({}),
  trialEndsAt: timestamp("trial_ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Stores (Lojas conectadas) ──

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    platform: platformEnum("platform").notNull(),
    apiUrl: varchar("api_url", { length: 500 }).notNull(),
    apiKey: varchar("api_key", { length: 500 }).notNull(),
    apiSecret: varchar("api_secret", { length: 500 }),
    webhookSecret: varchar("webhook_secret", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at"),
    syncStatus: varchar("sync_status", { length: 50 }).default("pending"),
    settings: jsonb("settings").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("stores_tenant_idx").on(table.tenantId),
  })
);

// ── Contacts (Clientes) ──

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    cpf: varchar("cpf", { length: 14 }),
    birthDate: timestamp("birth_date"),
    city: varchar("city", { length: 255 }),
    state: varchar("state", { length: 2 }),
    tags: jsonb("tags").default([]),

    // RFM Score
    rfmRecency: integer("rfm_recency").default(0),
    rfmFrequency: integer("rfm_frequency").default(0),
    rfmMonetary: integer("rfm_monetary").default(0),
    rfmScore: decimal("rfm_score", { precision: 5, scale: 2 }).default("0"),
    rfmSegment: rfmSegmentEnum("rfm_segment").default("new_customers"),

    // Aggregated metrics
    totalOrders: integer("total_orders").default(0),
    totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
    avgOrderValue: decimal("avg_order_value", { precision: 10, scale: 2 }).default("0"),
    lastOrderAt: timestamp("last_order_at"),
    firstOrderAt: timestamp("first_order_at"),

    isOptedIn: boolean("is_opted_in").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("contacts_tenant_idx").on(table.tenantId),
    emailIdx: index("contacts_email_idx").on(table.tenantId, table.email),
    phoneIdx: index("contacts_phone_idx").on(table.tenantId, table.phone),
    rfmIdx: index("contacts_rfm_idx").on(table.tenantId, table.rfmSegment),
    lastOrderIdx: index("contacts_last_order_idx").on(table.tenantId, table.lastOrderAt),
  })
);

// ── Orders (Pedidos) ──

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    orderNumber: varchar("order_number", { length: 100 }),
    status: orderStatusEnum("status").notNull().default("pending"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0"),
    shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0"),
    discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
    paymentMethod: varchar("payment_method", { length: 100 }),
    currency: varchar("currency", { length: 3 }).default("BRL"),
    items: jsonb("items").default([]),
    customerNote: text("customer_note"),
    trackingCode: varchar("tracking_code", { length: 255 }),
    shippingCarrier: varchar("shipping_carrier", { length: 100 }),
    placedAt: timestamp("placed_at"),
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("orders_tenant_idx").on(table.tenantId),
    storeIdx: index("orders_store_idx").on(table.storeId),
    contactIdx: index("orders_contact_idx").on(table.contactId),
    statusIdx: index("orders_status_idx").on(table.tenantId, table.status),
    placedAtIdx: index("orders_placed_at_idx").on(table.tenantId, table.placedAt),
    externalIdx: uniqueIndex("orders_external_idx").on(table.storeId, table.externalId),
  })
);

// ── Abandoned Carts ──

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    externalId: varchar("external_id", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    items: jsonb("items").default([]),
    total: decimal("total", { precision: 12, scale: 2 }).default("0"),
    checkoutUrl: text("checkout_url"),
    recoveryAttempts: integer("recovery_attempts").default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    recoveredAt: timestamp("recovered_at"),
    recoveredOrderId: uuid("recovered_order_id"),
    isRecovered: boolean("is_recovered").notNull().default(false),
    abandonedAt: timestamp("abandoned_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("carts_tenant_idx").on(table.tenantId),
    recoveredIdx: index("carts_recovered_idx").on(table.tenantId, table.isRecovered),
    abandonedAtIdx: index("carts_abandoned_at_idx").on(table.tenantId, table.abandonedAt),
  })
);

// ── Automations (Fluxos) ──

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    trigger: automationTriggerEnum("trigger").notNull(),
    conditions: jsonb("conditions").default({}),
    actions: jsonb("actions").default([]),
    isActive: boolean("is_active").notNull().default(false),
    totalExecutions: integer("total_executions").default(0),
    totalConversions: integer("total_conversions").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("automations_tenant_idx").on(table.tenantId),
  })
);

// ── Campaigns ──

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    channel: channelEnum("channel").notNull().default("whatsapp"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    segmentRules: jsonb("segment_rules").default({}),
    template: text("template"),
    templateVars: jsonb("template_vars").default({}),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    totalRecipients: integer("total_recipients").default(0),
    totalSent: integer("total_sent").default(0),
    totalDelivered: integer("total_delivered").default(0),
    totalRead: integer("total_read").default(0),
    totalClicked: integer("total_clicked").default(0),
    totalConverted: integer("total_converted").default(0),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("campaigns_tenant_idx").on(table.tenantId),
    statusIdx: index("campaigns_status_idx").on(table.tenantId, table.status),
  })
);

// ── Interactions (Histórico) ──

export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    type: varchar("type", { length: 50 }).notNull(), // message_sent, message_received, nps, etc
    content: text("content"),
    metadata: jsonb("metadata").default({}),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    contactIdx: index("interactions_contact_idx").on(table.contactId),
    tenantDateIdx: index("interactions_tenant_date_idx").on(
      table.tenantId,
      table.createdAt
    ),
  })
);

// ── Assistant Messages ──

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: varchar("conversation_id", { length: 100 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(), // user, assistant
    content: text("content").notNull(),
    intent: varchar("intent", { length: 50 }),
    confidence: real("confidence"),
    channel: varchar("channel", { length: 20 }).default("web"), // web, openclaw, whatsapp
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("assistant_msg_tenant_idx").on(table.tenantId),
    convIdx: index("assistant_msg_conv_idx").on(table.conversationId),
  })
);

// ── Webhook Logs ──

export const webhookLogs = pgTable(
  "webhook_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 100 }).notNull(),
    payload: jsonb("payload").default({}),
    status: varchar("status", { length: 20 }).default("received"),
    processedAt: timestamp("processed_at"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("webhook_logs_tenant_idx").on(table.tenantId),
  })
);

// ── Relations ──

export const tenantsRelations = relations(tenants, ({ many }) => ({
  stores: many(stores),
  contacts: many(contacts),
  orders: many(orders),
  campaigns: many(campaigns),
  automations: many(automations),
  assistantMessages: many(assistantMessages),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, { fields: [stores.tenantId], references: [tenants.id] }),
  contacts: many(contacts),
  orders: many(orders),
  abandonedCarts: many(abandonedCarts),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contacts.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [contacts.storeId], references: [stores.id] }),
  orders: many(orders),
  interactions: many(interactions),
  abandonedCarts: many(abandonedCarts),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  tenant: one(tenants, { fields: [orders.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  contact: one(contacts, { fields: [orders.contactId], references: [contacts.id] }),
}));

export const abandonedCartsRelations = relations(abandonedCarts, ({ one }) => ({
  tenant: one(tenants, { fields: [abandonedCarts.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [abandonedCarts.storeId], references: [stores.id] }),
  contact: one(contacts, { fields: [abandonedCarts.contactId], references: [contacts.id] }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  tenant: one(tenants, { fields: [interactions.tenantId], references: [tenants.id] }),
  contact: one(contacts, { fields: [interactions.contactId], references: [contacts.id] }),
  campaign: one(campaigns, { fields: [interactions.campaignId], references: [campaigns.id] }),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({ one }) => ({
  tenant: one(tenants, { fields: [assistantMessages.tenantId], references: [tenants.id] }),
}));
