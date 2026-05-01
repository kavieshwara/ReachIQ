"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { TemplateUploadGuide } from "@/components/shared/TemplateUploadGuide";
import { api } from "@/lib/api";

type WebsiteTemplate = {
  id: string;
  name: string;
  niche: string;
  html_content: string;
  preview_image_url?: string | null;
  is_active: boolean;
  created_at?: string;
};

export default function AdminWebsiteTemplatesPage() {
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    niche: "",
    html_content: "",
    preview_image_url: ""
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    const response = await api.get("/api/websites/templates");
    setTemplates(response.data || []);
  };

  useEffect(() => {
    loadTemplates().catch(() => null);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", draft.name);
      formData.append("niche", draft.niche);
      formData.append("preview_image_url", draft.preview_image_url);
      if (draft.html_content) formData.append("html_content", draft.html_content);
      if (file) formData.append("template_file", file);

      const { data } = await api.post("/api/websites/templates", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setTemplates((current) => [data, ...current]);
      setDraft({ name: "", niche: "", html_content: "", preview_image_url: "" });
      setFile(null);
      toast.success("Website template saved to the shared library");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not save website template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website templates"
        title="Open template library"
        description="Upload polished website templates that every ReachIQ user can generate from. Use this space to curate the shared template catalog."
      />

      <TemplateUploadGuide title="Admin upload guide" />

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-textPrimary">Upload template</p>
                <p className="text-sm text-textSecondary">Upload by file or paste HTML directly. If both are filled, the uploaded file wins.</p>
              </div>
              <Badge variant="success">Shared for all users</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Template name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Niche (restaurant, real_estate, dental)" value={draft.niche} onChange={(event) => setDraft((current) => ({ ...current, niche: event.target.value }))} />
            </div>

            <Input placeholder="Preview image URL (optional)" value={draft.preview_image_url} onChange={(event) => setDraft((current) => ({ ...current, preview_image_url: event.target.value }))} />

            <label className="flex cursor-pointer items-center justify-between rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 text-sm text-textSecondary">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-textPrimary">{file ? file.name : "Choose .html template file"}</p>
                  <p>Single self-contained HTML file with placeholders</p>
                </div>
              </div>
              <input
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <Textarea
              placeholder="Or paste the full HTML here"
              value={draft.html_content}
              onChange={(event) => setDraft((current) => ({ ...current, html_content: event.target.value }))}
              className="min-h-[320px]"
            />

            <div className="rounded-[22px] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-textSecondary">
              By uploading here, you confirm the template is safe, reusable, and okay to share as part of ReachIQ&apos;s open template library for all users.
            </div>

            <Button onClick={() => void handleSave()} disabled={saving || !draft.name || !draft.niche || (!draft.html_content && !file)}>
              {saving ? "Saving template..." : "Save to shared library"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-textPrimary">{template.name}</p>
                    <p className="text-sm text-textSecondary">{template.niche}</p>
                  </div>
                  <Badge variant={template.is_active ? "success" : "muted"}>
                    {template.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="line-clamp-6 text-xs leading-6 text-textMuted">{template.html_content}</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await api.patch(`/api/websites/templates/${template.id}`, { is_active: !template.is_active });
                      toast.success("Template status updated");
                      await loadTemplates();
                    }}
                  >
                    {template.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete ${template.name}?`);
                      if (!confirmed) return;
                      await api.delete(`/api/websites/templates/${template.id}`);
                      toast.success("Template deleted");
                      await loadTemplates();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!templates.length ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                  <Globe2 className="h-5 w-5" />
                </div>
                <p className="text-base font-medium text-textPrimary">No website templates yet</p>
                <p className="max-w-sm text-sm leading-6 text-textSecondary">Upload your first HTML template here and it will become available in the generator for everyone.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
