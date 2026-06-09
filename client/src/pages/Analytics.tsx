import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Loader2, HelpCircle } from "lucide-react";
import { useMemo } from "react";

function AnalyticsContent() {
  const { currentOrg } = useOrg();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: summary, isLoading } = trpc.analytics.summary.useQuery(
    {
      orgId: currentOrg?.id || 0,
      startDate: thirtyDaysAgo.toISOString(),
      endDate: now.toISOString(),
    },
    { enabled: !!currentOrg }
  );

  const { data: timeline } = trpc.analytics.timeline.useQuery(
    { orgId: currentOrg?.id || 0, days: 30 },
    { enabled: !!currentOrg }
  );

  // Get recent conversations to extract top questions
  const { data: conversations } = trpc.conversations.list.useQuery(
    { orgId: currentOrg?.id || 0, limit: 100 },
    { enabled: !!currentOrg }
  );

  // Group timeline events by day
  const dailyData = useMemo(() => {
    if (!timeline) return [];
    const grouped: Record<string, { date: string; messages: number; escalations: number; resolutions: number }> = {};

    timeline.forEach(event => {
      const day = new Date(event.createdAt).toLocaleDateString();
      if (!grouped[day]) grouped[day] = { date: day, messages: 0, escalations: 0, resolutions: 0 };
      if (event.eventType === "message_received") grouped[day].messages++;
      if (event.eventType === "escalation") grouped[day].escalations++;
      if (event.eventType === "resolution") grouped[day].resolutions++;
    });

    return Object.values(grouped).slice(-14);
  }, [timeline]);

  // Compute top questions from Q&A pair match counts
  const { data: qaPairs } = trpc.qaPairs.list.useQuery(
    { orgId: currentOrg?.id || 0 },
    { enabled: !!currentOrg }
  );

  const topQuestions = useMemo(() => {
    if (!qaPairs) return [];
    return [...qaPairs]
      .filter(p => (p.matchCount ?? 0) > 0)
      .sort((a, b) => (b.matchCount ?? 0) - (a.matchCount ?? 0))
      .slice(0, 5);
  }, [qaPairs]);

  const resolutionRate = summary
    ? summary.totalMessages > 0
      ? ((summary.resolutions / Math.max(summary.totalMessages, 1)) * 100).toFixed(1)
      : "0"
    : "0";

  const escalationRate = summary
    ? summary.totalMessages > 0
      ? ((summary.escalations / Math.max(summary.totalMessages, 1)) * 100).toFixed(1)
      : "0"
    : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your chatbot performance over the last 30 days</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
                <BarChart3 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalMessages || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Widget Opens</CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-2" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.widgetOpens || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resolution Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-chart-2" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{resolutionRate}%</div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Escalation Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{escalationRate}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Activity Chart */}
            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader>
                <CardTitle>Daily Activity (Last 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length > 0 ? (
                  <div className="space-y-2">
                    {dailyData.map((day, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{day.date}</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div
                            className="h-5 bg-primary/80 rounded-sm"
                            style={{ width: `${Math.min(100, day.messages * 10)}%` }}
                            title={`${day.messages} messages`}
                          />
                          {day.escalations > 0 && (
                            <div
                              className="h-5 bg-destructive/60 rounded-sm"
                              style={{ width: `${Math.min(30, day.escalations * 10)}%` }}
                              title={`${day.escalations} escalations`}
                            />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{day.messages} msgs</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-primary/80 rounded-sm" />
                        <span className="text-xs text-muted-foreground">Messages</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-destructive/60 rounded-sm" />
                        <span className="text-xs text-muted-foreground">Escalations</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">No activity data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Top Questions */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" /> Top Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {topQuestions.map((q, i) => (
                      <div key={q.id} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-primary shrink-0 mt-0.5">#{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm leading-tight">{q.question}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{q.matchCount} matches</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Top questions will appear here as your Q&A pairs get matched
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Conversation Stats */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Conversation Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{conversations?.length || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Conversations</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">
                    {conversations?.filter(c => c.status === "active").length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Active</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">
                    {conversations?.filter(c => c.status === "resolved").length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Resolved</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">
                    {conversations?.filter(c => c.status === "escalated").length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Escalated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Analytics() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <AnalyticsContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
