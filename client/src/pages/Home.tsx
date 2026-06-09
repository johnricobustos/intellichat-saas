import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Bot, Zap, Shield, BarChart3, Code, Brain, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function OnboardingFlow() {
  const { currentOrg, organizations } = useOrg();
  const [, setLocation] = useLocation();
  const [orgName, setOrgName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const createOrgMutation = trpc.org.create.useMutation({
    onSuccess: () => {
      toast.success("Organization created!");
      utils.org.list.invalidate();
      setShowCreate(false);
      setLocation("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (organizations.length > 0) {
      setLocation("/dashboard");
    }
  }, [organizations, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to IntelliChat</h1>
          <p className="text-muted-foreground">Create your first organization to get started</p>
        </div>

        <div className="space-y-4">
          <Input
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            placeholder="Your company name"
            className="h-12"
          />
          <Button
            className="w-full h-12"
            onClick={() => orgName && createOrgMutation.mutate({ name: orgName })}
            disabled={!orgName || createOrgMutation.isPending}
          >
            {createOrgMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create Organization
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedHome() {
  return (
    <OrgProvider>
      <OnboardingFlow />
    </OrgProvider>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <AuthenticatedHome />;
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">IntelliChat</span>
          </div>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            Sign In <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-24 sm:py-32">
          <div className="container text-center space-y-8">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
              AI Customer Support That
              <span className="text-primary"> Learns Your Business</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Deploy an intelligent chatbot trained on your documents in minutes. Embed it on any website. Watch it learn and improve over time.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={() => window.location.href = getLoginUrl()} className="h-12 px-8">
                Get Started Free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-card/50">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">Everything You Need</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: Brain, title: "RAG-Powered AI", desc: "Answers grounded in your actual documents. No hallucinations." },
                { icon: Code, title: "Easy Embed", desc: "One script tag. Works on any website. Fully customizable." },
                { icon: Zap, title: "Continuous Learning", desc: "Train with Q&A pairs. The bot gets smarter every day." },
                { icon: Shield, title: "Smart Escalation", desc: "Auto-escalate when confidence is low or keywords are detected." },
                { icon: BarChart3, title: "Full Analytics", desc: "Track resolution rates, popular questions, and performance." },
                { icon: Bot, title: "Multi-Tenant", desc: "Manage multiple chatbots for different clients from one dashboard." },
              ].map(feature => (
                <div key={feature.title} className="p-6 rounded-xl bg-card border border-border">
                  <feature.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container text-center space-y-6">
            <h2 className="text-3xl font-bold">Ready to Transform Your Customer Support?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Join businesses using IntelliChat to provide instant, accurate support 24/7.
            </p>
            <Button size="lg" onClick={() => window.location.href = getLoginUrl()} className="h-12 px-8">
              Start Building Your Chatbot <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          IntelliChat SaaS Platform — AI-Powered Customer Support
        </div>
      </footer>
    </div>
  );
}
