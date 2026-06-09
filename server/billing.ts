/**
 * Stripe Billing Module
 *
 * Handles subscription checkout, plan management, and webhook events.
 * Requires STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables.
 *
 * Plans:
 * - starter: $29/month - 1,000 messages, 5 docs, 1 org
 * - pro: $79/month - 10,000 messages, 50 docs, 5 orgs
 * - enterprise: $199/month - unlimited
 */

import { getDb } from "./db";
import { organizations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Plan configuration
export const PLANS = {
  starter: {
    name: "Starter",
    price: 2900, // cents
    monthlyMessages: 1000,
    maxDocuments: 5,
    maxOrgs: 1,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || "",
  },
  pro: {
    name: "Pro",
    price: 7900,
    monthlyMessages: 10000,
    maxDocuments: 50,
    maxOrgs: 5,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
  },
  enterprise: {
    name: "Enterprise",
    price: 19900,
    monthlyMessages: -1, // unlimited
    maxDocuments: -1,
    maxOrgs: -1,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
  },
} as const;

export type PlanName = keyof typeof PLANS;

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_"));
}

/**
 * Get Stripe instance (lazy loaded)
 */
let stripeInstance: any = null;
async function getStripe() {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
  }
  if (!stripeInstance) {
    // Dynamic import to avoid errors when Stripe is not installed
    try {
      const Stripe = (await import("stripe")).default;
      stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2024-12-18.acacia" as any,
      });
    } catch (e) {
      throw new Error("Stripe package not installed. Run: pnpm add stripe");
    }
  }
  return stripeInstance;
}

/**
 * Create a Stripe Checkout session for a plan upgrade
 */
export async function createCheckoutSession(params: {
  orgId: number;
  plan: PlanName;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = await getStripe();
  const planConfig = PLANS[params.plan];

  if (!planConfig.stripePriceId) {
    throw new Error(`No Stripe Price ID configured for plan: ${params.plan}. Set STRIPE_${params.plan.toUpperCase()}_PRICE_ID`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.customerEmail,
    line_items: [
      {
        price: planConfig.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      orgId: params.orgId.toString(),
      plan: params.plan,
    },
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const stripe = await getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return { url: session.url };
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(payload: string | Buffer, signature: string) {
  const stripe = await getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }

  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = parseInt(session.metadata?.orgId || "0");
      const plan = session.metadata?.plan as PlanName;

      if (orgId && plan) {
        await upgradePlan(orgId, plan, session.customer as string, session.subscription as string);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await handleSubscriptionUpdate(subscription.id, subscription.status, subscription.customer as string);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await handleSubscriptionCancellation(subscription.customer as string);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.warn(`[Billing] Payment failed for invoice ${invoice.id}`);
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  return { received: true };
}

/**
 * Upgrade an organization's plan
 */
async function upgradePlan(orgId: number, plan: PlanName, customerId: string, subscriptionId: string) {
  const db = await getDb();
  if (!db) return;

  const planConfig = PLANS[plan];

  await db.update(organizations).set({
    plan,
    monthlyMessageLimit: planConfig.monthlyMessages,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  }).where(eq(organizations.id, orgId));

  console.log(`[Billing] Org ${orgId} upgraded to ${plan}`);
}

/**
 * Handle subscription status updates (active, past_due, canceled, etc.)
 */
async function handleSubscriptionUpdate(subscriptionId: string, status: string, customerId: string) {
  const db = await getDb();
  if (!db) return;

  // Find the organization by Stripe customer ID
  const [org] = await db.select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (!org) {
    console.warn(`[Billing] No org found for customer ${customerId}`);
    return;
  }

  if (status === "past_due" || status === "unpaid") {
    // Reduce limits when payment fails but don't fully downgrade yet
    console.warn(`[Billing] Subscription ${subscriptionId} is ${status} for org ${org.id}`);
  } else if (status === "canceled" || status === "incomplete_expired") {
    // Downgrade to starter
    await db.update(organizations).set({
      plan: "starter",
      monthlyMessageLimit: PLANS.starter.monthlyMessages,
      stripeSubscriptionId: null,
    }).where(eq(organizations.id, org.id));
    console.log(`[Billing] Org ${org.id} downgraded to starter (subscription ${status})`);
  }
}

/**
 * Handle subscription cancellation - downgrade org to starter plan
 */
async function handleSubscriptionCancellation(customerId: string) {
  const db = await getDb();
  if (!db) return;

  // Find the organization by Stripe customer ID
  const [org] = await db.select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (!org) {
    console.warn(`[Billing] No org found for customer ${customerId} during cancellation`);
    return;
  }

  // Downgrade to starter plan
  await db.update(organizations).set({
    plan: "starter",
    monthlyMessageLimit: PLANS.starter.monthlyMessages,
    stripeSubscriptionId: null,
  }).where(eq(organizations.id, org.id));

  console.log(`[Billing] Org ${org.id} subscription cancelled, downgraded to starter`);
}

/**
 * Get the current subscription status for an organization
 */
export async function getSubscriptionStatus(orgId: number) {
  const db = await getDb();
  if (!db) return null;

  const [org] = await db.select({
    plan: organizations.plan,
    stripeCustomerId: organizations.stripeCustomerId,
    stripeSubscriptionId: organizations.stripeSubscriptionId,
    messagesUsed: organizations.messagesUsedThisMonth,
    messageLimit: organizations.monthlyMessageLimit,
  }).from(organizations).where(eq(organizations.id, orgId)).limit(1);

  return org || null;
}
