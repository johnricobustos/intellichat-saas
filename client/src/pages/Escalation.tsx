import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, AlertTriangle, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function EscalationContent() {
  const { currentOrg } = useOrg();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState<"confidence" | "keyword">("confidence");
  const [ruleValue, setRuleValue] = useState("");
  const [action, setAction] = useState<"email" | "flag" | "both">("flag");
  const [emailTarget, setEmailTarget] = useState("");

  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.escalation.list.useQuery(
    { orgId: currentOrg?.id || 0 },
    { enabled: !!currentOrg }
  );

  // Get escalated conversations for the log
  const { data: conversations } = trpc.conversations.list.useQuery(
    { orgId: currentOrg?.id || 0, limit: 100 },
    { enabled: !!currentOrg }
  );

  const escalatedConversations = conversations?.filter(c => c.status === "escalated") || [];

  const createMutation = trpc.escalation.create.useMutation({
    onSuccess: () => {
      toast.success("Escalation rule created!");
      setOpen(false);
      setRuleValue("");
      setEmailTarget("");
      utils.escalation.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.escalation.delete.useMutation({
    onSuccess: () => {
      toast.success("Rule deleted");
      utils.escalation.list.invalidate();
    },
  });

  const toggleMutation = trpc.escalation.update.useMutation({
    onSuccess: () => utils.escalation.list.invalidate(),
  });

  const handleCreate = () => {
    if (!currentOrg || !ruleValue) return;
    createMutation.mutate({
      orgId: currentOrg.id,
      ruleType,
      ruleValue,
      action,
      emailTarget: emailTarget || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escalation</h1>
          <p className="text-muted-foreground mt-1">Configure rules and view escalated conversations</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Add Escalation Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Rule Type</Label>
                <Select value={ruleType} onValueChange={(v: any) => setRuleType(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confidence">Low Confidence Threshold</SelectItem>
                    <SelectItem value="keyword">Keyword Trigger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{ruleType === "confidence" ? "Threshold (0-1, e.g., 0.3)" : "Keywords (comma-separated)"}</Label>
                <Input
                  value={ruleValue}
                  onChange={e => setRuleValue(e.target.value)}
                  placeholder={ruleType === "confidence" ? "0.3" : "refund, complaint, manager"}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Action</Label>
                <Select value={action} onValueChange={(v: any) => setAction(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flag">Flag for Review</SelectItem>
                    <SelectItem value="email">Send Email</SelectItem>
                    <SelectItem value="both">Flag + Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(action === "email" || action === "both") && (
                <div>
                  <Label>Email Target</Label>
                  <Input
                    value={emailTarget}
                    onChange={e => setEmailTarget(e.target.value)}
                    placeholder="support@company.com"
                    className="mt-1"
                    type="email"
                  />
                </div>
              )}
              <Button onClick={handleCreate} disabled={!ruleValue} className="w-full">
                Create Rule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules ({rules?.length || 0})</TabsTrigger>
          <TabsTrigger value="log">Escalation Log ({escalatedConversations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rules && rules.length > 0 ? (
            <div className="space-y-3">
              {rules.map(rule => (
                <Card key={rule.id} className="bg-card border-border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-chart-3" />
                      <div>
                        <p className="font-medium text-sm">
                          {rule.ruleType === "confidence" ? `Confidence below ${(parseFloat(rule.ruleValue) * 100).toFixed(0)}%` : `Keywords: ${rule.ruleValue}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Action: {rule.action} {rule.emailTarget ? `→ ${rule.emailTarget}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={rule.isActive ?? true}
                        onCheckedChange={(checked) => toggleMutation.mutate({ ruleId: rule.id, isActive: checked })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ ruleId: rule.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No escalation rules</h3>
                <p className="text-muted-foreground text-sm mt-1 text-center max-w-md">
                  Add rules to automatically escalate conversations when confidence is low or specific keywords are detected.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          {escalatedConversations.length > 0 ? (
            <div className="space-y-3">
              {escalatedConversations.map(conv => (
                <Card
                  key={conv.id}
                  className="bg-card border-border cursor-pointer hover:border-destructive/50 transition-colors"
                  onClick={() => setLocation(`/conversations/${conv.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium">{conv.visitorName || "Anonymous Visitor"}</p>
                        <p className="text-xs text-muted-foreground">
                          {conv.visitorEmail || "No email"} · {conv.messageCount} messages
                        </p>
                        {conv.escalationReason && (
                          <p className="text-xs text-destructive mt-0.5">{conv.escalationReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Escalated</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No escalated conversations</h3>
                <p className="text-muted-foreground text-sm mt-1">Escalated conversations will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Escalation() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <EscalationContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
