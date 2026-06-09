import DashboardLayout from "@/components/DashboardLayout";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, Globe, Upload, Loader2, RefreshCw } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

function DocumentsContent() {
  const { currentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<"txt" | "url" | "pdf">("txt");
  const [url, setUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.documents.list.useQuery(
    { orgId: currentOrg?.id || 0 },
    { enabled: !!currentOrg }
  );

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded! Processing will begin shortly.");
      setOpen(false);
      resetForm();
      utils.documents.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      utils.documents.list.invalidate();
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setUrl("");
    setSourceType("txt");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setTitle(file.name.replace(/\.[^/.]+$/, ""));

    try {
      const text = await file.text();
      setContent(text);
      toast.success(`File "${file.name}" loaded`);
    } catch {
      toast.error("Failed to read file. Please paste the content manually.");
    }
    setIsUploading(false);
  };

  const handleSubmit = () => {
    if (!currentOrg || !title) return;
    const finalContent = sourceType === "url" ? (content || url) : content;
    if (!finalContent) {
      toast.error("Please provide content");
      return;
    }
    uploadMutation.mutate({
      orgId: currentOrg.id,
      title,
      sourceType,
      content: finalContent,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">Upload documents to train your chatbot</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Document</Button>
          </DialogTrigger>
          <DialogContent className="bg-card max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
            </DialogHeader>
            <Tabs value={sourceType} onValueChange={(v: any) => setSourceType(v)} className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="txt" className="flex-1">Text / File</TabsTrigger>
                <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
                <TabsTrigger value="pdf" className="flex-1">PDF / Doc</TabsTrigger>
              </TabsList>

              <TabsContent value="txt" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="FAQ Document" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Paste your document content here... (FAQ, policies, product info, etc.)"
                    className="mt-1 min-h-[200px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <Upload className="h-3 w-3 mr-1" /> Upload .txt file
                  </Button>
                  <span className="text-xs text-muted-foreground">or paste content above</span>
                </div>
              </TabsContent>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Website FAQ" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">URL</label>
                  <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/faq" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Paste the URL and the extracted content below</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Page Content</label>
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Paste the webpage text content here..."
                    className="mt-1 min-h-[150px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Product Manual" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Paste extracted text content</label>
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Paste the text content extracted from your PDF or DOCX file here..."
                    className="mt-1 min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: Open your PDF in a reader, select all text (Ctrl+A), copy (Ctrl+C), and paste here.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="pdf-file-input"
                  />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById("pdf-file-input")?.click()} disabled={isUploading}>
                    <Upload className="h-3 w-3 mr-1" /> Upload .txt file
                  </Button>
                  <span className="text-xs text-muted-foreground">For PDF/DOCX, paste extracted text above</span>
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleSubmit} disabled={!title || uploadMutation.isPending} className="w-full mt-4">
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload & Process
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map(doc => (
            <Card key={doc.id} className="bg-card border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {doc.sourceType === "url" ? <Globe className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.sourceType.toUpperCase()} · {doc.chunkCount || 0} chunks · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    doc.status === "ready" ? "default" :
                    doc.status === "processing" ? "secondary" : "destructive"
                  }>
                    {doc.status}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => currentOrg && deleteMutation.mutate({ orgId: currentOrg.id, docId: doc.id })}>
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
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No documents yet</h3>
            <p className="text-muted-foreground text-sm mt-1 text-center max-w-md">
              Upload documents to build your knowledge base. The chatbot will use these to answer questions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Documents() {
  return (
    <OrgProvider>
      <DashboardLayout>
        <DocumentsContent />
      </DashboardLayout>
    </OrgProvider>
  );
}
