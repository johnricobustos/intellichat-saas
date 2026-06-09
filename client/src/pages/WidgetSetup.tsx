import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Code, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function WidgetSetupContent() {
  const { currentOrg } = useOrg();

  const widgetScript = currentOrg ? `<!-- IntelliChat Widget -->
<script>
  (function() {
    var w = document.createElement('script');
    w.src = '${window.location.origin}/widget.js';
    w.setAttribute('data-api-key', '${currentOrg.apiKey}');
    w.setAttribute('data-position', 'bottom-right');
    w.async = true;
    document.head.appendChild(w);
  })();
</script>` : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(widgetScript);
    toast.success("Widget code copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Widget Setup</h1>
        <p className="text-muted-foreground mt-1">Embed the chat widget on your website</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" /> Embed Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy and paste this code snippet just before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag of your website.
          </p>
          <div className="relative">
            <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-xs font-mono text-foreground">
              {widgetScript}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={copyToClipboard}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Configuration Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="font-medium text-sm">data-position</p>
              <p className="text-xs text-muted-foreground mt-1">Widget position: "bottom-right" or "bottom-left"</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="font-medium text-sm">data-api-key</p>
              <p className="text-xs text-muted-foreground mt-1">Your organization API key (auto-filled)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>Upload documents to your knowledge base (Documents page)</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>Configure your bot personality and welcome message (Settings page)</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>Copy the embed code above and paste it into your website</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <span>Set up escalation rules for when the bot can't answer (Escalation page)</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">5</span>
              <span>Monitor conversations and train the bot with Q&A pairs as needed</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WidgetSetup() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <WidgetSetupContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
