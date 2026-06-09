import { describe, expect, it } from "vitest";
import { PLANS, isStripeConfigured } from "./billing";

describe("billing", () => {
  describe("PLANS configuration", () => {
    it("has all three plan tiers defined", () => {
      expect(PLANS.starter).toBeDefined();
      expect(PLANS.pro).toBeDefined();
      expect(PLANS.enterprise).toBeDefined();
    });

    it("starter plan has correct pricing and limits", () => {
      expect(PLANS.starter.price).toBe(2900);
      expect(PLANS.starter.monthlyMessages).toBe(1000);
      expect(PLANS.starter.maxDocuments).toBe(5);
      expect(PLANS.starter.maxOrgs).toBe(1);
    });

    it("pro plan has correct pricing and limits", () => {
      expect(PLANS.pro.price).toBe(7900);
      expect(PLANS.pro.monthlyMessages).toBe(10000);
      expect(PLANS.pro.maxDocuments).toBe(50);
      expect(PLANS.pro.maxOrgs).toBe(5);
    });

    it("enterprise plan has unlimited resources", () => {
      expect(PLANS.enterprise.price).toBe(19900);
      expect(PLANS.enterprise.monthlyMessages).toBe(-1);
      expect(PLANS.enterprise.maxDocuments).toBe(-1);
      expect(PLANS.enterprise.maxOrgs).toBe(-1);
    });

    it("plan prices are in ascending order", () => {
      expect(PLANS.starter.price).toBeLessThan(PLANS.pro.price);
      expect(PLANS.pro.price).toBeLessThan(PLANS.enterprise.price);
    });
  });

  describe("isStripeConfigured", () => {
    it("returns false when STRIPE_SECRET_KEY is not set", () => {
      const original = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;
      expect(isStripeConfigured()).toBe(false);
      if (original) process.env.STRIPE_SECRET_KEY = original;
    });

    it("returns false when STRIPE_SECRET_KEY does not start with sk_", () => {
      const original = process.env.STRIPE_SECRET_KEY;
      process.env.STRIPE_SECRET_KEY = "invalid_key";
      expect(isStripeConfigured()).toBe(false);
      if (original) process.env.STRIPE_SECRET_KEY = original;
      else delete process.env.STRIPE_SECRET_KEY;
    });

    it("returns true when STRIPE_SECRET_KEY starts with sk_", () => {
      const original = process.env.STRIPE_SECRET_KEY;
      process.env.STRIPE_SECRET_KEY = "sk_test_12345";
      expect(isStripeConfigured()).toBe(true);
      if (original) process.env.STRIPE_SECRET_KEY = original;
      else delete process.env.STRIPE_SECRET_KEY;
    });
  });
});
