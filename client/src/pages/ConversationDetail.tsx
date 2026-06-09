import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

function ConversationDetailContent() {
  const { currentOrg } = useOrg();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const convId = parseInt(params.id || "0");

  const utils = trpc.useUtils();
  const { data: conversation, isLoading } = trpc.conversations.get.useQuery(
    { orgId: currentOrg?.id || 0, conversationId: convId },
    { enabled: !!currentOrg && convId > 0 }
  );

  const resolveMutation = trpc.conversations.resolve.useMutation({
    onSuccess: () => {
      toast.success("Conversation marked as resolved");
      utils.conversations.get.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return <p className="text-muted-foreground">Conversation not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/conversations")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{conversation.visitorName || "Anonymous Visitor"}</h1>
          <p className="text-muted-foreground text-sm">
            {conversation.visitorEmail || "No email"} · Started {new Date(conversation.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant={
          conversation.status === "active" ? "default" :
          conversation.status === "escalated" ? "destructive" : "secondary"
        }>
          {conversation.status}
        </Badge>
        {conversation.status !== "resolved" && (
          <Button
            variant="outline"
            onClick={() => currentOrg && resolveMutation.mutate({ orgId: currentOrg.id, conversationId: convId })}
          >
            <CheckCircle className="h-4 w-4 mr-2" /> Resolve
          </Button>
        )}
      </div>

      {conversation.escalationReason && (
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">Escalation Reason: {conversation.escalationReason}</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
          {conversation.messages?.map((msg: any) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs opacity-70">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                  {msg.confidence && (
                    <span className="text-xs opacity-70">
                      {(msg.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                  {msg.wasEscalated && (
                    <Badge variant="destructive" className="text-xs h-4">escalated</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConversationDetail() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <ConversationDetailContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
