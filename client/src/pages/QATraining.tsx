import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Brain, MessageSquare, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function QATrainingContent() {
  const { currentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const utils = trpc.useUtils();

  const { data: pairs, isLoading } = trpc.qaPairs.list.useQuery(
    { orgId: currentOrg?.id || 0 },
    { enabled: !!currentOrg }
  );

  // Get recent conversations for review panel
  const { data: conversations } = trpc.conversations.list.useQuery(
    { orgId: currentOrg?.id || 0, limit: 20 },
    { enabled: !!currentOrg }
  );

  const createMutation = trpc.qaPairs.create.useMutation({
    onSuccess: () => {
      toast.success("Q&A pair saved!");
      setOpen(false);
      resetForm();
      utils.qaPairs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.qaPairs.update.useMutation({
    onSuccess: () => {
      toast.success("Q&A pair updated!");
      setOpen(false);
      resetForm();
      utils.qaPairs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.qaPairs.delete.useMutation({
    onSuccess: () => {
      toast.success("Q&A pair deleted");
      utils.qaPairs.list.invalidate();
    },
  });

  const toggleMutation = trpc.qaPairs.update.useMutation({
    onSuccess: () => utils.qaPairs.list.invalidate(),
  });

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    setEditId(null);
  };

  const handleSave = () => {
    if (!currentOrg || !question || !answer) return;
    if (editId) {
      updateMutation.mutate({ pairId: editId, question, answer });
    } else {
      createMutation.mutate({ orgId: currentOrg.id, question, answer });
    }
  };

  const handleEdit = (pair: any) => {
    setEditId(pair.id);
    setQuestion(pair.question);
    setAnswer(pair.answer);
    setOpen(true);
  };

  // Correction workflow: create Q&A pair from a conversation message
  const handleCorrection = (userMsg: string) => {
    setQuestion(userMsg);
    setAnswer("");
    setEditId(null);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Q&A Training</h1>
          <p className="text-muted-foreground mt-1">Teach your bot with custom Q&A pairs that override AI responses</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Q&A Pair</Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Q&A Pair" : "Add Q&A Pair"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Question (what the user might ask)</label>
                <Textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="How do I reset my password?"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Answer (the correct response)</label>
                <Textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="To reset your password, go to Settings > Security..."
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <Button onClick={handleSave} disabled={!question || !answer} className="w-full">
                {editId ? "Update Pair" : "Create Pair"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="pairs">
        <TabsList>
          <TabsTrigger value="pairs">Q&A Pairs ({pairs?.length || 0})</TabsTrigger>
          <TabsTrigger value="review">Review Conversations</TabsTrigger>
        </TabsList>

        <TabsContent value="pairs" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pairs && pairs.length > 0 ? (
            pairs.map(pair => (
              <Card key={pair.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div>
                        <span className="text-xs font-medium text-primary">Q:</span>
                        <p className="text-sm font-medium">{pair.question}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-chart-2">A:</span>
                        <p className="text-sm text-muted-foreground">{pair.answer}</p>
                      </div>
                      {(pair.matchCount ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Matched {pair.matchCount} times
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={pair.isActive ?? true}
                        onCheckedChange={(checked) => toggleMutation.mutate({ pairId: pair.id, isActive: checked })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(pair)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ pairId: pair.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Q&A pairs yet</h3>
                <p className="text-muted-foreground text-sm mt-1 text-center max-w-md">
                  Add custom Q&A pairs to override AI responses for specific questions. These take priority over the RAG engine.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Review recent conversations and create Q&A overrides for incorrect bot responses. Click "Correct" to create a Q&A pair from a question.
          </p>
          {conversations && conversations.length > 0 ? (
            conversations.filter(c => c.status === "escalated" || c.status === "active").slice(0, 10).map(conv => (
              <ConversationReviewCard
                key={conv.id}
                conversation={conv}
                orgId={currentOrg?.id || 0}
                onCorrect={handleCorrection}
              />
            ))
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No conversations to review</h3>
                <p className="text-muted-foreground text-sm mt-1">Conversations will appear here for review</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConversationReviewCard({ conversation, orgId, onCorrect }: { conversation: any; orgId: number; onCorrect: (q: string) => void }) {
  const { data: detail } = trpc.conversations.get.useQuery(
    { orgId, conversationId: conversation.id },
    { enabled: !!orgId }
  );

  const utils = trpc.useUtils();
  const resolveMutation = trpc.conversations.resolve.useMutation({
    onSuccess: () => {
      toast.success("Conversation marked as resolved");
      utils.conversations.list.invalidate();
    },
  });

  if (!detail || !detail.messages) return null;

  // Show last few exchanges
  const recentMessages = detail.messages.slice(-4);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={conversation.status === "escalated" ? "destructive" : "default"}>
              {conversation.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {conversation.visitorName || "Anonymous"} · {new Date(conversation.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resolveMutation.mutate({ orgId, conversationId: conversation.id })}
          >
            <CheckCircle className="h-3 w-3 mr-1" /> Resolve
          </Button>
        </div>
        <div className="space-y-2 border-l-2 border-border pl-3">
          {recentMessages.map((msg: any) => (
            <div key={msg.id} className="flex items-start gap-2">
              <Badge variant={msg.role === "user" ? "default" : "secondary"} className="text-xs shrink-0">
                {msg.role === "user" ? "User" : "Bot"}
              </Badge>
              <p className="text-sm flex-1">{msg.content.slice(0, 200)}{msg.content.length > 200 ? "..." : ""}</p>
              {msg.role === "user" && (
                <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => onCorrect(msg.content)}>
                  Correct
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function QATraining() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <QATrainingContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
