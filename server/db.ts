import { eq, and, desc, sql, like, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  organizations, InsertOrganization, Organization,
  orgMembers,
  documents, InsertDocument,
  documentChunks, InsertDocumentChunk,
  conversations, InsertConversation,
  messages, InsertMessage,
  qaPairs, InsertQaPair,
  escalationRules, InsertEscalationRule,
  analyticsEvents, InsertAnalyticsEvent,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from "nanoid";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USERS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== ORGANIZATIONS ====================
export async function createOrganization(data: { name: string; ownerId: number; slug?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const apiKey = `ic_${nanoid(32)}`;

  const result = await db.insert(organizations).values({
    name: data.name,
    slug,
    apiKey,
    ownerId: data.ownerId,
    welcomeMessage: "Hi! How can I help you today?",
    botPersonality: "You are a helpful customer support assistant. Be concise, friendly, and accurate. Only answer based on the provided context. If you don't know the answer, say so honestly.",
  });

  const orgId = result[0].insertId;

  // Add owner as org member
  await db.insert(orgMembers).values({
    orgId,
    userId: data.ownerId,
    role: "owner",
  });

  return { id: orgId, slug, apiKey };
}

export async function getOrganizationById(orgId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return result[0];
}

export async function getOrganizationByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.apiKey, apiKey)).limit(1);
  return result[0];
}

export async function getOrganizationBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return result[0];
}

export async function getUserOrganizations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select().from(orgMembers).where(eq(orgMembers.userId, userId));
  if (memberships.length === 0) return [];
  const orgIds = memberships.map(m => m.orgId);
  const orgs = await db.select().from(organizations).where(inArray(organizations.id, orgIds));
  return orgs.map(org => ({
    ...org,
    memberRole: memberships.find(m => m.orgId === org.id)?.role || "member",
  }));
}

export async function updateOrganization(orgId: number, data: Partial<InsertOrganization>) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set(data).where(eq(organizations.id, orgId));
}

export async function regenerateApiKey(orgId: number) {
  const db = await getDb();
  if (!db) return "";
  const newKey = `ic_${nanoid(32)}`;
  await db.update(organizations).set({ apiKey: newKey }).where(eq(organizations.id, orgId));
  return newKey;
}

// ==================== DOCUMENTS ====================
export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return result[0].insertId;
}

export async function getDocumentsByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.orgId, orgId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentById(docId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  return result[0];
}

export async function updateDocument(docId: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set(data).where(eq(documents.id, docId));
}

export async function deleteDocument(docId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentChunks).where(eq(documentChunks.documentId, docId));
  await db.delete(documents).where(eq(documents.id, docId));
}

// ==================== DOCUMENT CHUNKS ====================
export async function insertChunks(chunks: InsertDocumentChunk[]) {
  const db = await getDb();
  if (!db) return;
  if (chunks.length === 0) return;
  // Insert in batches of 50
  for (let i = 0; i < chunks.length; i += 50) {
    const batch = chunks.slice(i, i + 50);
    await db.insert(documentChunks).values(batch);
  }
}

export async function getChunksByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentChunks).where(eq(documentChunks.orgId, orgId));
}

export async function getChunksByDocument(docId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentChunks).where(eq(documentChunks.documentId, docId)).orderBy(documentChunks.chunkIndex);
}

// ==================== CONVERSATIONS ====================
export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(conversations).values(data);
  return result[0].insertId;
}

export async function getConversationsByOrg(orgId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations)
    .where(eq(conversations.orgId, orgId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getConversationById(convId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  return result[0];
}

export async function getConversationBySession(orgId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.sessionId, sessionId)))
    .limit(1);
  return result[0];
}

export async function updateConversation(convId: number, data: Partial<InsertConversation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set(data).where(eq(conversations.id, convId));
}

// ==================== MESSAGES ====================
export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  // Update conversation message count
  await db.execute(sql`UPDATE conversations SET messageCount = messageCount + 1 WHERE id = ${data.conversationId}`);
  return result[0].insertId;
}

export async function getMessagesByConversation(convId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(messages.createdAt);
}

export async function getRecentMessages(orgId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(eq(messages.orgId, orgId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

// ==================== Q&A PAIRS ====================
export async function createQaPair(data: InsertQaPair) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(qaPairs).values(data);
  return result[0].insertId;
}

export async function getQaPairsByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(qaPairs)
    .where(eq(qaPairs.orgId, orgId))
    .orderBy(desc(qaPairs.updatedAt));
}

export async function updateQaPair(pairId: number, data: Partial<InsertQaPair>) {
  const db = await getDb();
  if (!db) return;
  await db.update(qaPairs).set(data).where(eq(qaPairs.id, pairId));
}

export async function deleteQaPair(pairId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(qaPairs).where(eq(qaPairs.id, pairId));
}

export async function incrementQaMatchCount(pairId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE qa_pairs SET matchCount = matchCount + 1 WHERE id = ${pairId}`);
}

// ==================== ESCALATION RULES ====================
export async function createEscalationRule(data: InsertEscalationRule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(escalationRules).values(data);
  return result[0].insertId;
}

export async function getEscalationRulesByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(escalationRules).where(eq(escalationRules.orgId, orgId));
}

export async function updateEscalationRule(ruleId: number, data: Partial<InsertEscalationRule>) {
  const db = await getDb();
  if (!db) return;
  await db.update(escalationRules).set(data).where(eq(escalationRules.id, ruleId));
}

export async function deleteEscalationRule(ruleId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(escalationRules).where(eq(escalationRules.id, ruleId));
}

// ==================== ANALYTICS ====================
export async function trackEvent(data: InsertAnalyticsEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analyticsEvents).values(data);
}

export async function getAnalyticsSummary(orgId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { totalMessages: 0, totalConversations: 0, escalations: 0, resolutions: 0 };

  const events = await db.select().from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.orgId, orgId),
      gte(analyticsEvents.createdAt, startDate),
      lte(analyticsEvents.createdAt, endDate),
    ));

  return {
    totalMessages: events.filter(e => e.eventType === "message_received").length,
    totalConversations: events.filter(e => e.eventType === "message_sent").length,
    escalations: events.filter(e => e.eventType === "escalation").length,
    resolutions: events.filter(e => e.eventType === "resolution").length,
    widgetOpens: events.filter(e => e.eventType === "widget_opened").length,
  };
}

export async function getAnalyticsTimeline(orgId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const events = await db.select().from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.orgId, orgId),
      gte(analyticsEvents.createdAt, startDate),
    ))
    .orderBy(analyticsEvents.createdAt);

  return events;
}

// ==================== USAGE TRACKING ====================
export async function incrementMessageUsage(orgId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE organizations SET messagesUsedThisMonth = messagesUsedThisMonth + 1 WHERE id = ${orgId}`);
}

export async function resetMonthlyUsage(orgId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set({ messagesUsedThisMonth: 0 }).where(eq(organizations.id, orgId));
}
