import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float, boolean, bigint } from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== ORGANIZATIONS ====================
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  apiKey: varchar("apiKey", { length: 64 }).notNull().unique(),
  ownerId: int("ownerId").notNull(),
  plan: mysqlEnum("plan", ["starter", "pro", "enterprise"]).default("starter").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  // Bot settings
  botName: varchar("botName", { length: 128 }).default("AI Assistant"),
  botPersonality: text("botPersonality"),
  welcomeMessage: text("welcomeMessage"),
  botAvatar: text("botAvatar"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#6366f1"),
  // Limits
  monthlyMessageLimit: int("monthlyMessageLimit").default(1000),
  maxDocuments: int("maxDocuments").default(10),
  messagesUsedThisMonth: int("messagesUsedThisMonth").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ==================== ORG MEMBERS ====================
export const orgMembers = mysqlTable("org_members", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrgMember = typeof orgMembers.$inferSelect;

// ==================== DOCUMENTS ====================
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  sourceType: mysqlEnum("sourceType", ["pdf", "txt", "url", "docx"]).notNull(),
  sourceUrl: text("sourceUrl"),
  fileKey: text("fileKey"),
  status: mysqlEnum("status", ["processing", "ready", "error"]).default("processing").notNull(),
  chunkCount: int("chunkCount").default(0),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ==================== DOCUMENT CHUNKS ====================
export const documentChunks = mysqlTable("document_chunks", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  documentId: int("documentId").notNull(),
  content: text("content").notNull(),
  embedding: json("embedding"), // Store embedding vector as JSON array
  chunkIndex: int("chunkIndex").notNull(),
  tokenCount: int("tokenCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

// ==================== CONVERSATIONS ====================
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  visitorName: varchar("visitorName", { length: 255 }),
  visitorEmail: varchar("visitorEmail", { length: 320 }),
  status: mysqlEnum("status", ["active", "resolved", "escalated"]).default("active").notNull(),
  escalatedAt: timestamp("escalatedAt"),
  escalationReason: text("escalationReason"),
  messageCount: int("messageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ==================== MESSAGES ====================
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  orgId: int("orgId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  confidence: float("confidence"),
  sourceDocs: json("sourceDocs"), // Array of chunk IDs used
  wasEscalated: boolean("wasEscalated").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ==================== Q&A PAIRS (Training) ====================
export const qaPairs = mysqlTable("qa_pairs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  isActive: boolean("isActive").default(true),
  matchCount: int("matchCount").default(0),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QaPair = typeof qaPairs.$inferSelect;
export type InsertQaPair = typeof qaPairs.$inferInsert;

// ==================== ESCALATION RULES ====================
export const escalationRules = mysqlTable("escalation_rules", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  ruleType: mysqlEnum("ruleType", ["confidence", "keyword", "sentiment"]).notNull(),
  // For confidence: threshold value (0-1)
  // For keyword: comma-separated keywords
  // For sentiment: negative sentiment threshold
  ruleValue: text("ruleValue").notNull(),
  action: mysqlEnum("action", ["email", "flag", "both"]).default("flag").notNull(),
  emailTarget: varchar("emailTarget", { length: 320 }),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EscalationRule = typeof escalationRules.$inferSelect;
export type InsertEscalationRule = typeof escalationRules.$inferInsert;

// ==================== ANALYTICS EVENTS ====================
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  eventType: mysqlEnum("eventType", ["message_sent", "message_received", "escalation", "resolution", "widget_opened"]).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;
