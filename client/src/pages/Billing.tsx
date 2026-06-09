import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Zap, Rocket, Building2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const plans = [
  {
    name: "Starter",
    key: "starter" as const,
    price: "$29",
    period: "/month",
    icon: Zap,
    description: "Perfect for small businesses getting started",
    features: ["1,000 messages/month", "5 documents", "1 organization", "Basic analytics", "Email support"],
    highlighted: false,
  },
  {
    name: "Pro",
    key: "pro" as const,
    price: "$79",
    period: "/month",
    icon: Rocket,
    description: "For growing businesses with higher volume",
    features: ["10,000 messages/month", "50 documents", "5 organizations", "Advanced analytics", "Priority support", "Custom branding", "Escalation rules"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    key: "enterprise" as const,
    price: "$199",
    period: "/month",
    icon: Building2,
    description: "For large teams with unlimited needs",
    features: ["Unlimited messages", "Unlimited documents", "Unlimited organizations", "Full analytics suite", "Dedicated support", "White-label options", "API access", "Custom integrations"],
    highlighted: false,
  },
];

function BillingContent() {
  const { currentOrg } = useOrg();
  const currentPlan = currentOrg?.plan || "starter";

  const { data: billingStatus } = trpc.billing.status.useQuery(
    { orgId: currentOrg?.id || 0 },
    { enabled: !!currentOrg }
  );

  const checkoutMutation = trpc.billing.checkout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const portalMutation = trpc.billing.portal.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpgrade = (planKey: "starter" | "pro" | "enterprise") => {
    if (!currentOrg) return;
    if (!billingStatus?.stripeConfigured) {
      toast.info("Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to your environment variables. See README for setup instructions.");
      return;
    }
    checkoutMutation.mutate({
      orgId: currentOrg.id,
      plan: planKey,
      successUrl: `${window.location.origin}/billing?success=true`,
      cancelUrl: `${window.location.origin}/billing?cancelled=true`,
    });
  };

  const handleManageSubscription = () => {
    if (!currentOrg) return;
    portalMutation.mutate({
      orgId: currentOrg.id,
      returnUrl: `${window.location.origin}/billing`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current Plan & Usage */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-xl font-bold capitalize">{currentPlan}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Messages Used</p>
              <p className="text-xl font-bold">
                {currentOrg?.messagesUsedThisMonth || 0}
                <span className="text-sm font-normal text-muted-foreground">
                  {" / "}{currentOrg?.monthlyMessageLimit === -1 ? "∞" : (currentOrg?.monthlyMessageLimit || 1000)}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                <Badge variant="default">Active</Badge>
                {currentOrg?.stripeSubscriptionId && (
                  <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Manage
                  </Button>
                )}
              </div>
            </div>
          </div>
          {/* Usage bar */}
          {(currentOrg?.monthlyMessageLimit ?? 0) > 0 && (
            <div className="mt-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((currentOrg?.messagesUsedThisMonth || 0) / (currentOrg?.monthlyMessageLimit || 1000)) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => {
          const isCurrent = plan.key === currentPlan;
          const Icon = plan.icon;
          return (
            <Card key={plan.key} className={`bg-card border-border relative ${plan.highlighted ? "ring-2 ring-primary" : ""}`}>
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : plan.highlighted ? "default" : "outline"}
                  disabled={isCurrent || checkoutMutation.isPending}
                  onClick={() => handleUpgrade(plan.key)}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stripe Setup Notice */}
      {!billingStatus?.stripeConfigured && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Payment processing is powered by Stripe. To enable live billing, add your{" "}
              <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code>,{" "}
              <code className="bg-muted px-1 rounded">STRIPE_WEBHOOK_SECRET</code>, and plan Price IDs to your environment variables.
              See the README for detailed setup instructions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Billing() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <BillingContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
