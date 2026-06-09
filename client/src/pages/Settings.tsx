import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RefreshCw, Loader2, Users, Settings2, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const toneOptions = [
  { value: "professional", label: "Professional", desc: "Formal and business-like" },
  { value: "friendly", label: "Friendly", desc: "Warm and conversational" },
  { value: "concise", label: "Concise", desc: "Short and to the point" },
  { value: "detailed", label: "Detailed", desc: "Thorough explanations" },
  { value: "casual", label: "Casual", desc: "Relaxed and informal" },
];

function SettingsContent() {
  const { currentOrg } = useOrg();
  const [name, setName] = useState("");
  const [botName, setBotName] = useState("");
  const [personality, setPersonality] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [tone, setTone] = useState("professional");

  const utils = trpc.useUtils();

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name || "");
      setBotName(currentOrg.botName || "");
      setPersonality(currentOrg.botPersonality || "");
      setWelcomeMessage(currentOrg.welcomeMessage || "");
      setPrimaryColor(currentOrg.primaryColor || "#6366f1");
      // Extract tone from personality if it contains a tone prefix
      const toneMatch = (currentOrg.botPersonality || "").match(/\[tone:(\w+)\]/);
      if (toneMatch) setTone(toneMatch[1]);
    }
  }, [currentOrg]);

  const updateMutation = trpc.org.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved!");
      utils.org.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateKeyMutation = trpc.org.regenerateKey.useMutation({
    onSuccess: (data) => {
      toast.success("API key regenerated!");
      utils.org.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!currentOrg) return;
    // Prepend tone marker to personality
    const personalityWithTone = personality.includes(`[tone:`)
      ? personality.replace(/\[tone:\w+\]/, `[tone:${tone}]`)
      : `[tone:${tone}] ${personality}`;

    updateMutation.mutate({
      orgId: currentOrg.id,
      name,
      botName,
      botPersonality: personalityWithTone,
      welcomeMessage,
      primaryColor,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your organization and bot</p>
      </div>

      <Tabs defaultValue="bot">
        <TabsList>
          <TabsTrigger value="bot"><Bot className="h-3.5 w-3.5 mr-1.5" /> Bot Config</TabsTrigger>
          <TabsTrigger value="org"><Settings2 className="h-3.5 w-3.5 mr-1.5" /> Organization</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1.5" /> Team</TabsTrigger>
        </TabsList>

        {/* Bot Configuration */}
        <TabsContent value="bot" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Bot Personality</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Bot Name</Label>
                <Input value={botName} onChange={e => setBotName(e.target.value)} placeholder="AI Assistant" className="mt-1" />
              </div>
              <div>
                <Label>Welcome Message</Label>
                <Input value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="Hi! How can I help you today?" className="mt-1" />
              </div>
              <div>
                <Label>Response Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">— {opt.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>System Prompt / Personality</Label>
                <Textarea
                  value={personality.replace(/\[tone:\w+\]\s?/, "")}
                  onChange={e => setPersonality(e.target.value)}
                  placeholder="You are a helpful customer support assistant for our company..."
                  className="mt-1 min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground mt-1">This defines how your bot behaves. Be specific about your brand voice and rules.</p>
              </div>
              <div>
                <Label>Widget Color</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer border border-border" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-32" />
                  <div className="h-10 w-10 rounded" style={{ backgroundColor: primaryColor }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Bot Settings
          </Button>
        </TabsContent>

        {/* Organization Settings */}
        <TabsContent value="org" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>API Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={currentOrg?.apiKey || ""} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => currentOrg && regenerateKeyMutation.mutate({ orgId: currentOrg.id })}
                    title="Regenerate API Key"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Used to authenticate your chat widget. Keep this secret!</p>
              </div>
              <div>
                <Label>Plan</Label>
                <Input value={(currentOrg?.plan || "starter").toUpperCase()} readOnly className="mt-1 capitalize" />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Organization Settings
          </Button>
        </TabsContent>

        {/* Team Management */}
        <TabsContent value="team" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Current user (owner) */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">You (Owner)</p>
                      <p className="text-xs text-muted-foreground">{currentOrg?.memberRole || "owner"}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Owner</span>
                </div>
              </div>

              <div className="mt-6 p-4 border border-dashed border-border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Team member invitations are available on Pro and Enterprise plans.
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => toast.info("Upgrade to Pro to invite team members")}>
                  Invite Members
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Settings() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <SettingsContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
