import { db } from "../src/lib/db";
import { tenants, stores, contacts, orders, abandonedCarts, campaigns } from "../src/lib/db/schema";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const DEMO_EMAIL = "demo@sellzin.com";
const DEMO_PASSWORD = "demo1234";

const firstNames = ["Ana", "Carlos", "Maria", "João", "Juliana", "Pedro", "Fernanda", "Lucas", "Camila", "Rafael", "Larissa", "Bruno", "Amanda", "Diego", "Patricia", "Marcos", "Gabriela", "Thiago", "Beatriz", "Felipe"];
const lastNames = ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Melo", "Barbosa", "Ribeiro", "Martins", "Carvalho", "Gomes", "Rocha", "Ferreira", "Correia"];
const cities = [
  { city: "São Paulo", state: "SP" }, { city: "Rio de Janeiro", state: "RJ" },
  { city: "Belo Horizonte", state: "MG" }, { city: "Salvador", state: "BA" },
  { city: "Curitiba", state: "PR" }, { city: "Recife", state: "PE" },
  { city: "Fortaleza", state: "CE" }, { city: "Porto Alegre", state: "RS" },
  { city: "Brasília", state: "DF" }, { city: "Campinas", state: "SP" },
];
const products = [
  { name: "Camiseta Premium", sku: "CAM-001", price: 89.90 },
  { name: "Calça Jeans Slim", sku: "CAL-002", price: 179.90 },
  { name: "Tênis Esportivo", sku: "TEN-003", price: 299.90 },
  { name: "Jaqueta Corta-vento", sku: "JAQ-004", price: 249.90 },
  { name: "Boné Snapback", sku: "BON-005", price: 59.90 },
  { name: "Mochila Urban", sku: "MOC-006", price: 149.90 },
  { name: "Óculos de Sol", sku: "OCU-007", price: 199.90 },
  { name: "Relógio Digital", sku: "REL-008", price: 349.90 },
  { name: "Bermuda Surf", sku: "BER-009", price: 129.90 },
  { name: "Sandália Slide", sku: "SAN-010", price: 79.90 },
];
const segments: any[] = ["champions", "loyal", "potential", "new_customers", "at_risk", "cant_lose", "hibernating", "lost"];
const statuses: any[] = ["pending", "processing", "shipped", "delivered", "cancelled"];
const paymentMethods = ["PIX", "Cartão de Crédito", "Boleto", "Cartão de Débito"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(daysAgo: number): Date { return new Date(Date.now() - Math.random() * daysAgo * 86400000); }

async function seed() {
  console.log("🌱 Seeding database...");

  // Create demo tenant
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const apiKey = `sk_demo_${nanoid(32)}`;

  const [tenant] = await db.insert(tenants).values({
    name: "Loja Demo",
    email: DEMO_EMAIL,
    passwordHash,
    apiKey,
    plan: "growth",
    trialEndsAt: new Date(Date.now() + 14 * 86400000),
  }).onConflictDoNothing().returning();

  if (!tenant) {
    console.log("Demo tenant already exists. Skipping.");
    process.exit(0);
  }

  console.log(`✅ Tenant: ${tenant.email} / ${DEMO_PASSWORD}`);

  // Create store
  const [store] = await db.insert(stores).values({
    tenantId: tenant.id,
    name: "Loja Principal",
    platform: "woocommerce",
    apiUrl: "https://demo.loja.com",
    apiKey: "ck_demo_key",
    apiSecret: "cs_demo_secret",
    webhookSecret: `whsec_${nanoid(32)}`,
    isActive: true,
    syncStatus: "synced",
    lastSyncAt: new Date(),
  }).returning();

  console.log(`✅ Store: ${store.name}`);

  // Create contacts
  const contactIds: string[] = [];
  for (let i = 0; i < 150; i++) {
    const firstName = rand(firstNames);
    const lastName = rand(lastNames);
    const loc = rand(cities);
    const segment = rand(segments);
    const totalOrders = segment === "champions" ? randInt(8, 20) :
      segment === "loyal" ? randInt(4, 10) :
      segment === "new_customers" ? randInt(1, 2) :
      segment === "at_risk" ? randInt(3, 6) :
      segment === "lost" ? randInt(1, 3) : randInt(1, 5);
    const totalSpent = totalOrders * (randInt(80, 350));

    const [contact] = await db.insert(contacts).values({
      tenantId: tenant.id,
      storeId: store.id,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
      phone: `5511${randInt(90000, 99999)}${randInt(1000, 9999)}`,
      firstName,
      lastName,
      city: loc.city,
      state: loc.state,
      cpf: `${randInt(100, 999)}.${randInt(100, 999)}.${randInt(100, 999)}-${randInt(10, 99)}`,
      rfmRecency: randInt(1, 5),
      rfmFrequency: randInt(1, 5),
      rfmMonetary: randInt(1, 5),
      rfmScore: (randInt(10, 50) / 10).toFixed(2),
      rfmSegment: segment,
      totalOrders,
      totalSpent: totalSpent.toFixed(2),
      avgOrderValue: (totalSpent / totalOrders).toFixed(2),
      lastOrderAt: randomDate(segment === "lost" ? 120 : segment === "at_risk" ? 60 : 30),
      firstOrderAt: randomDate(365),
      tags: i % 5 === 0 ? ["vip"] : i % 7 === 0 ? ["black-friday"] : [],
      isOptedIn: Math.random() > 0.15,
    }).returning();

    contactIds.push(contact.id);
  }

  console.log(`✅ ${contactIds.length} contatos criados`);

  // Create orders
  let orderCount = 0;
  for (const contactId of contactIds) {
    const numOrders = randInt(1, 5);
    for (let j = 0; j < numOrders; j++) {
      const numItems = randInt(1, 4);
      const items = [];
      let subtotal = 0;
      for (let k = 0; k < numItems; k++) {
        const product = rand(products);
        const qty = randInt(1, 3);
        items.push({ ...product, quantity: qty, total: (product.price * qty).toFixed(2) });
        subtotal += product.price * qty;
      }
      const shippingCost = randInt(0, 30);
      const discount = Math.random() > 0.7 ? randInt(10, 50) : 0;
      const total = subtotal + shippingCost - discount;

      await db.insert(orders).values({
        tenantId: tenant.id,
        storeId: store.id,
        contactId,
        externalId: `wc_${nanoid(8)}`,
        orderNumber: String(1000 + orderCount),
        status: rand(statuses),
        total: total.toFixed(2),
        subtotal: subtotal.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        discount: discount.toFixed(2),
        paymentMethod: rand(paymentMethods),
        items,
        placedAt: randomDate(90),
      });
      orderCount++;
    }
  }

  console.log(`✅ ${orderCount} pedidos criados`);

  // Create abandoned carts
  let cartCount = 0;
  for (let i = 0; i < 40; i++) {
    const contactId = rand(contactIds);
    const numItems = randInt(1, 3);
    const items = [];
    let total = 0;
    for (let k = 0; k < numItems; k++) {
      const product = rand(products);
      const qty = randInt(1, 2);
      items.push({ ...product, quantity: qty, total: (product.price * qty).toFixed(2) });
      total += product.price * qty;
    }

    await db.insert(abandonedCarts).values({
      tenantId: tenant.id,
      storeId: store.id,
      contactId,
      externalId: `cart_${nanoid(8)}`,
      items,
      total: total.toFixed(2),
      checkoutUrl: `https://demo.loja.com/checkout/recover/${nanoid(16)}`,
      recoveryAttempts: randInt(0, 2),
      isRecovered: Math.random() > 0.7,
      recoveredAt: Math.random() > 0.7 ? randomDate(10) : null,
      abandonedAt: randomDate(30),
    });
    cartCount++;
  }

  console.log(`✅ ${cartCount} carrinhos abandonados criados`);

  // Create campaigns
  const campaignData = [
    { name: "Black Friday 2024", status: "completed", channel: "whatsapp", recipients: 120, sent: 118, delivered: 112, read: 89, clicked: 45, converted: 18, revenue: 4250.00 },
    { name: "Reativação Inativos", status: "completed", channel: "whatsapp", recipients: 35, sent: 34, delivered: 32, read: 21, clicked: 12, converted: 5, revenue: 890.00 },
    { name: "Natal - Cupom 15%", status: "running", channel: "whatsapp", recipients: 80, sent: 45, delivered: 42, read: 28, clicked: 15, converted: 8, revenue: 1680.00 },
    { name: "Ano Novo VIP", status: "draft", channel: "whatsapp", recipients: 0, sent: 0, delivered: 0, read: 0, clicked: 0, converted: 0, revenue: 0 },
  ];

  for (const c of campaignData) {
    await db.insert(campaigns).values({
      tenantId: tenant.id,
      name: c.name,
      channel: c.channel as any,
      status: c.status as any,
      totalRecipients: c.recipients,
      totalSent: c.sent,
      totalDelivered: c.delivered,
      totalRead: c.read,
      totalClicked: c.clicked,
      totalConverted: c.converted,
      revenue: c.revenue.toFixed(2),
      startedAt: c.status !== "draft" ? randomDate(30) : null,
      completedAt: c.status === "completed" ? randomDate(7) : null,
    });
  }

  console.log(`✅ ${campaignData.length} campanhas criadas`);
  console.log("\n🎉 Seed completo!");
  console.log(`\n📧 Login: ${DEMO_EMAIL}`);
  console.log(`🔑 Senha: ${DEMO_PASSWORD}`);
  console.log(`🔗 API Key: ${apiKey}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
