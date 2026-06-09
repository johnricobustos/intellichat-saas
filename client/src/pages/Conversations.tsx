import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Loader2, Search } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

function ConversationsContent() {
  const { currentOrg } = useOrg();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: conversations, isLoading } = trpc.conversations.list.useQuery(
    { orgId: currentOrg?.id || 0, limit: 100 },
    { enabled: !!currentOrg }
  );

  const filtered = useMemo(() => {
    if (!conversations) return [];
    return conversations.filter(conv => {
      const matchesSearch = !search ||
        (conv.visitorName || "").toLowerCase().includes(search.toLowerCase()) ||
        (conv.visitorEmail || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || conv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [conversations, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-muted-foreground mt-1">View and manage all chat conversations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by visitor name or email..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(conv => (
            <Card
              key={conv.id}
              className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setLocation(`/conversations/${conv.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{conv.visitorName || "Anonymous Visitor"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conv.visitorEmail || "No email"} · {conv.messageCount} messages
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={
                    conv.status === "active" ? "default" :
                    conv.status === "escalated" ? "destructive" : "secondary"
                  }>
                    {conv.status}
                  </Badge>
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
            <h3 className="font-semibold text-lg">
              {conversations && conversations.length > 0 ? "No matching conversations" : "No conversations yet"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {conversations && conversations.length > 0
                ? "Try adjusting your search or filters"
                : "Conversations will appear here once visitors start chatting"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Conversations() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <ConversationsContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
