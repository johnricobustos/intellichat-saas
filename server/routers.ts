import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createOrganization, getUserOrganizations, getOrganizationById,
  updateOrganization, regenerateApiKey, getOrganizationByApiKey,
  createDocument, getDocumentsByOrg, getDocumentById, updateDocument, deleteDocument,
  insertChunks, getChunksByDocument,
  createConversation, getConversationsByOrg, getConversationById,
  getConversationBySession, updateConversation,
  createMessage, getMessagesByConversation, getRecentMessages,
  createQaPair, getQaPairsByOrg, updateQaPair, deleteQaPair,
  createEscalationRule, getEscalationRulesByOrg, updateEscalationRule, deleteEscalationRule,
  trackEvent, getAnalyticsSummary, getAnalyticsTimeline,
  incrementMessageUsage,
} from "./db";
import { processDocumentText, generateChatResponse } from "./rag";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { createCheckoutSession, createPortalSession, isStripeConfigured, getSubscriptionStatus, PLANS } from "./billing";

// Helper to verify org membership
async function verifyOrgAccess(userId: number, orgId: number) {
  const orgs = await getUserOrganizations(userId);
  const org = orgs.find(o => o.id === orgId);
  if (!org) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
  return org;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== ORGANIZATIONS ====================
  org: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserOrganizations(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        return createOrganization({ name: input.name, ownerId: ctx.user.id });
      }),

    get: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getOrganizationById(input.orgId);
      }),

    update: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        name: z.string().min(1).max(255).optional(),
        botName: z.string().max(128).optional(),
        botPersonality: z.string().optional(),
        welcomeMessage: z.string().optional(),
        primaryColor: z.string().max(7).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        const { orgId, ...data } = input;
        await updateOrganization(orgId, data);
        return { success: true };
      }),

    regenerateKey: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const org = await verifyOrgAccess(ctx.user.id, input.orgId);
        if (org.memberRole !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
        const newKey = await regenerateApiKey(input.orgId);
        return { apiKey: newKey };
      }),
  }),

  // ==================== DOCUMENTS ====================
  documents: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getDocumentsByOrg(input.orgId);
      }),

    upload: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        title: z.string().min(1),
        sourceType: z.enum(["pdf", "txt", "url", "docx"]),
        content: z.string(), // Base64 for files, URL for urls, plain text for txt
      }))
      .mutation(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);

        // Create document record
        const docId = await createDocument({
          orgId: input.orgId,
          title: input.title,
          sourceType: input.sourceType,
          status: "processing",
        });

        // Process in background (non-blocking)
        processAndIndexDocument(docId, input.orgId, input.content, input.sourceType).catch(err => {
          console.error(`[Doc Processing] Failed for doc ${docId}:`, err);
        });

        return { id: docId, status: "processing" };
      }),

    get: protectedProcedure
      .input(z.object({ orgId: z.number(), docId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getDocumentById(input.docId);
      }),

    delete: protectedProcedure
      .input(z.object({ orgId: z.number(), docId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        await deleteDocument(input.docId);
        return { success: true };
      }),

    chunks: protectedProcedure
      .input(z.object({ orgId: z.number(), docId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        const chunks = await getChunksByDocument(input.docId);
        return chunks.map(c => ({ id: c.id, content: c.content, chunkIndex: c.chunkIndex, tokenCount: c.tokenCount }));
      }),
  }),

  // ==================== CONVERSATIONS ====================
  conversations: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getConversationsByOrg(input.orgId, input.limit, input.offset);
      }),

    get: protectedProcedure
      .input(z.object({ orgId: z.number(), conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        const conv = await getConversationById(input.conversationId);
        if (!conv || conv.orgId !== input.orgId) throw new TRPCError({ code: "NOT_FOUND" });
        const msgs = await getMessagesByConversation(input.conversationId);
        return { ...conv, messages: msgs };
      }),

    resolve: protectedProcedure
      .input(z.object({ orgId: z.number(), conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        await updateConversation(input.conversationId, { status: "resolved" });
        await trackEvent({ orgId: input.orgId, eventType: "resolution" });
        return { success: true };
      }),
  }),

  // ==================== Q&A PAIRS ====================
  qaPairs: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getQaPairsByOrg(input.orgId);
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        question: z.string().min(1),
        answer: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        const id = await createQaPair({
          orgId: input.orgId,
          question: input.question,
          answer: input.answer,
          createdBy: ctx.user.id,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        pairId: z.number(),
        question: z.string().min(1).optional(),
        answer: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { pairId, ...data } = input;
        await updateQaPair(pairId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ pairId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteQaPair(input.pairId);
        return { success: true };
      }),
  }),

  // ==================== ESCALATION RULES ====================
  escalation: router({
    list: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getEscalationRulesByOrg(input.orgId);
      }),

    create: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        ruleType: z.enum(["confidence", "keyword", "sentiment"]),
        ruleValue: z.string().min(1),
        action: z.enum(["email", "flag", "both"]),
        emailTarget: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        const id = await createEscalationRule(input);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        ruleId: z.number(),
        ruleValue: z.string().optional(),
        action: z.enum(["email", "flag", "both"]).optional(),
        emailTarget: z.string().email().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { ruleId, ...data } = input;
        await updateEscalationRule(ruleId, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ ruleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteEscalationRule(input.ruleId);
        return { success: true };
      }),
  }),

  // ==================== ANALYTICS ====================
  analytics: router({
    summary: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getAnalyticsSummary(input.orgId, new Date(input.startDate), new Date(input.endDate));
      }),

    timeline: protectedProcedure
      .input(z.object({ orgId: z.number(), days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        return getAnalyticsTimeline(input.orgId, input.days);
      }),
  }),

  // ==================== BILLING ====================
  billing: router({
    status: protectedProcedure
      .input(z.object({ orgId: z.number() }))
      .query(async ({ ctx, input }) => {
        await verifyOrgAccess(ctx.user.id, input.orgId);
        const sub = await getSubscriptionStatus(input.orgId);
        return {
          ...sub,
          stripeConfigured: isStripeConfigured(),
          plans: PLANS,
        };
      }),

    checkout: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        plan: z.enum(["starter", "pro", "enterprise"]),
        successUrl: z.string(),
        cancelUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const org = await verifyOrgAccess(ctx.user.id, input.orgId);
        if (!isStripeConfigured()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe is not configured. Add STRIPE_SECRET_KEY to environment variables." });
        }
        const result = await createCheckoutSession({
          orgId: input.orgId,
          plan: input.plan,
          customerEmail: ctx.user.email || "",
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        });
        return result;
      }),

    portal: protectedProcedure
      .input(z.object({ orgId: z.number(), returnUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const org = await verifyOrgAccess(ctx.user.id, input.orgId);
        if (!org.stripeCustomerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription found" });
        }
        const result = await createPortalSession({
          customerId: org.stripeCustomerId,
          returnUrl: input.returnUrl,
        });
        return result;
      }),
  }),

  // ==================== PUBLIC CHAT API (for widget) ====================
  chat: router({
    send: publicProcedure
      .input(z.object({
        apiKey: z.string(),
        sessionId: z.string(),
        message: z.string().min(1),
        visitorName: z.string().optional(),
        visitorEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        // Validate API key
        const org = await getOrganizationByApiKey(input.apiKey);
        if (!org) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid API key" });

        // Check usage limits
        if (org.messagesUsedThisMonth && org.monthlyMessageLimit &&
            org.messagesUsedThisMonth >= org.monthlyMessageLimit) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Monthly message limit reached" });
        }

        // Get or create conversation
        let conversation = await getConversationBySession(org.id, input.sessionId);
        if (!conversation) {
          const convId = await createConversation({
            orgId: org.id,
            sessionId: input.sessionId,
            visitorName: input.visitorName || null,
            visitorEmail: input.visitorEmail || null,
          });
          conversation = await getConversationById(convId);
        }

        if (!conversation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Save user message
        await createMessage({
          conversationId: conversation.id,
          orgId: org.id,
          role: "user",
          content: input.message,
        });

        // Get conversation history
        const history = await getMessagesByConversation(conversation.id);
        const conversationHistory = history.slice(-10).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        // Generate AI response
        const response = await generateChatResponse(input.message, {
          orgId: org.id,
          conversationHistory,
          botPersonality: org.botPersonality || "",
          botName: org.botName || "AI Assistant",
        });

        // Check escalation rules
        let shouldEscalate = false;
        let escalationReason = "";
        const rules = await getEscalationRulesByOrg(org.id);
        const activeRules = rules.filter(r => r.isActive);

        for (const rule of activeRules) {
          if (rule.ruleType === "confidence") {
            const threshold = parseFloat(rule.ruleValue);
            if (response.confidence < threshold) {
              shouldEscalate = true;
              escalationReason = `Low confidence (${(response.confidence * 100).toFixed(0)}% < ${(threshold * 100).toFixed(0)}%)`;
              break;
            }
          } else if (rule.ruleType === "keyword") {
            const keywords = rule.ruleValue.split(",").map(k => k.trim().toLowerCase());
            const messageLower = input.message.toLowerCase();
            const matched = keywords.find(k => messageLower.includes(k));
            if (matched) {
              shouldEscalate = true;
              escalationReason = `Keyword trigger: "${matched}"`;
              break;
            }
          }
        }

        // Save assistant message
        await createMessage({
          conversationId: conversation.id,
          orgId: org.id,
          role: "assistant",
          content: response.answer,
          confidence: response.confidence,
          sourceDocs: response.sourceDocs,
          wasEscalated: shouldEscalate,
        });

        // Track analytics
        await trackEvent({ orgId: org.id, eventType: "message_received" });
        await trackEvent({ orgId: org.id, eventType: "message_sent" });
        await incrementMessageUsage(org.id);

        if (shouldEscalate) {
          await updateConversation(conversation.id, {
            status: "escalated",
            escalationReason,
          });
          await trackEvent({ orgId: org.id, eventType: "escalation", metadata: { reason: escalationReason } });
        }

        return {
          answer: response.answer,
          confidence: response.confidence,
          escalated: shouldEscalate,
          escalationReason: shouldEscalate ? escalationReason : undefined,
        };
      }),

    // Get widget config (public)
    config: publicProcedure
      .input(z.object({ apiKey: z.string() }))
      .query(async ({ input }) => {
        const org = await getOrganizationByApiKey(input.apiKey);
        if (!org) throw new TRPCError({ code: "NOT_FOUND" });
        return {
          botName: org.botName,
          welcomeMessage: org.welcomeMessage,
          primaryColor: org.primaryColor,
          botAvatar: org.botAvatar,
        };
      }),

    // Track widget open event
    opened: publicProcedure
      .input(z.object({ apiKey: z.string() }))
      .mutation(async ({ input }) => {
        const org = await getOrganizationByApiKey(input.apiKey);
        if (!org) return { success: false };
        await trackEvent({ orgId: org.id, eventType: "widget_opened" });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ==================== BACKGROUND PROCESSING ====================
async function processAndIndexDocument(docId: number, orgId: number, content: string, sourceType: string) {
  try {
    let textContent = content;

    // For base64 encoded files, decode first
    if (sourceType === "pdf" || sourceType === "docx") {
      // For now, treat as plain text (in production, use pdf-parse or mammoth)
      textContent = Buffer.from(content, "base64").toString("utf-8");
    }

    // For URLs, the content is already extracted on the frontend
    // Process and create chunks
    const processedChunks = await processDocumentText(textContent);

    // Insert chunks
    const chunksToInsert = processedChunks.map((chunk, index) => ({
      orgId,
      documentId: docId,
      content: chunk.content,
      embedding: chunk.embedding,
      chunkIndex: index,
      tokenCount: chunk.tokenCount,
    }));

    await insertChunks(chunksToInsert);

    // Update document status
    await updateDocument(docId, {
      status: "ready",
      chunkCount: chunksToInsert.length,
    });
  } catch (error: any) {
    console.error(`[Doc Processing] Error:`, error);
    await updateDocument(docId, {
      status: "error",
      errorMessage: error.message || "Unknown processing error",
    });
  }
}
