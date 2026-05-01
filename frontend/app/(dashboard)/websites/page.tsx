"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Globe, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { TemplateUploadGuide } from "@/components/shared/TemplateUploadGuide";
import { api } from "@/lib/api";

type WebsiteTemplate = {
  id: string;
  name: string;
  niche: string;
  html_content: string;
  is_active?: boolean;
  preview_image_url?: string | null;
};

export default function WebsitesPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [generated, setGenerated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    lead_id: "",
    template_id: "",
    business_name: "",
    phone: "",
    address: "",
    city: "",
    tagline: "",
    services: ""
  });
  const [uploadDraft, setUploadDraft] = useState({
    name: "",
    niche: "",
    html_content: "",
    preview_image_url: ""
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadPage = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [leadResponse, templateResponse, generatedResponse] = await Promise.all([
        api.get("/api/leads", { params: { page: 1, pageSize: 100, hasWebsite: false } }),
        api.get("/api/websites/templates"),
        api.get("/api/websites")
      ]);

      setLeads(leadResponse.data.data || []);
      setTemplates(templateResponse.data || []);
      setGenerated(generatedResponse.data || []);
    } catch (error: any) {
      console.error("[ReachIQ][websites] failed to load page", error);
      setErrorMessage(error?.response?.data?.error || "Website tools could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === form.lead_id),
    [form.lead_id, leads]
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === form.template_id),
    [form.template_id, templates]
  );

  useEffect(() => {
    if (!selectedLead) return;
    setForm((current) => ({
      ...current,
      business_name: selectedLead.business_name || "",
      phone: selectedLead.phone || "",
      address: selectedLead.address || "",
      city: selectedLead.city || ""
    }));
  }, [selectedLead]);

  const handleUploadTemplate = async () => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("name", uploadDraft.name);
      formData.append("niche", uploadDraft.niche);
      formData.append("preview_image_url", uploadDraft.preview_image_url);
      if (uploadDraft.html_content) formData.append("html_content", uploadDraft.html_content);
      if (uploadFile) formData.append("template_file", uploadFile);

      const { data } = await api.post("/api/websites/templates", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setTemplates((current) => [data, ...current]);
      setUploadDraft({ name: "", niche: "", html_content: "", preview_image_url: "" });
      setUploadFile(null);
      toast.success("Template uploaded to the shared library");
    } catch (error: any) {
      console.error("[ReachIQ][websites] template upload failed", error);
      toast.error(error?.response?.data?.error || "Could not upload template");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateWebsite = async () => {
    try {
      setGenerating(true);
      const { data } = await api.post("/api/websites/generate", form);
      setGenerated((current) => [data, ...current]);
      toast.success("Website generated and ready to preview");
    } catch (error: any) {
      console.error("[ReachIQ][websites] generation failed", error);
      toast.error(
        error?.response?.data?.error ||
          "Website generation failed. Check the selected template and lead details."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website generator"
        title="Generate and share client-ready websites"
        description="Pick from the open ReachIQ template library, or upload your own HTML template so everyone can build with it."
      />

      <TemplateUploadGuide title="Template upload instructions for users" />

      {errorMessage ? (
        <Card className="border-danger/30 bg-danger/8">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-textSecondary">{errorMessage}</p>
            <Button variant="secondary" onClick={() => void loadPage()}>
              Retry loading
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-textPrimary">Generate website</p>
                <p className="text-sm text-textSecondary">
                  Choose a lead and a template from the shared library, then generate a hosted preview website.
                </p>
              </div>
              {selectedTemplate ? <Badge variant="success">{selectedTemplate.niche}</Badge> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select
                value={form.lead_id}
                onChange={(event) => setForm((current) => ({ ...current, lead_id: event.target.value }))}
              >
                <option value="">Select a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.business_name}
                  </option>
                ))}
              </Select>
              <Select
                value={form.template_id}
                onChange={(event) => setForm((current) => ({ ...current, template_id: event.target.value }))}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.niche}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Business name"
                value={form.business_name}
                onChange={(event) => setForm((current) => ({ ...current, business_name: event.target.value }))}
              />
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
              <Input
                placeholder="Address"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              />
              <Input
                placeholder="City"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              />
              <Input
                placeholder="Tagline"
                value={form.tagline}
                onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))}
              />
              <Input
                placeholder="Services (comma separated)"
                value={form.services}
                onChange={(event) => setForm((current) => ({ ...current, services: event.target.value }))}
              />
            </div>

            {selectedTemplate ? (
              <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                <p className="font-medium text-textPrimary">Selected template preview</p>
                <p className="mt-2 line-clamp-5 text-xs leading-6 text-textMuted">{selectedTemplate.html_content}</p>
              </div>
            ) : null}

            <Button
              disabled={generating || !form.lead_id || !form.template_id || !form.business_name || !form.phone}
              onClick={() => void handleGenerateWebsite()}
            >
              {generating ? "Generating..." : "Generate website"}
            </Button>
            {loading ? (
              <p className="text-sm text-textSecondary">Loading leads and templates for website generation...</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-textPrimary">Upload your own template</p>
                <p className="text-sm text-textSecondary">
                  Your upload becomes part of the shared ReachIQ template library, so write it like a reusable business demo that other users can safely generate too.
                </p>
              </div>
              <Badge variant="warning">Shared upload</Badge>
            </div>

            <Input
              placeholder="Template name"
              value={uploadDraft.name}
              onChange={(event) => setUploadDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              placeholder="Niche (restaurant, salon, real_estate)"
              value={uploadDraft.niche}
              onChange={(event) => setUploadDraft((current) => ({ ...current, niche: event.target.value }))}
            />
            <Input
              placeholder="Preview image URL (optional)"
              value={uploadDraft.preview_image_url}
              onChange={(event) =>
                setUploadDraft((current) => ({ ...current, preview_image_url: event.target.value }))
              }
            />

            <label className="flex cursor-pointer items-center gap-3 rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 text-sm text-textSecondary">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-textPrimary">{uploadFile ? uploadFile.name : "Choose .html file"}</p>
                <p className="truncate">Single self-contained HTML template</p>
              </div>
              <input
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
            </label>

            <Textarea
              placeholder="Or paste the full HTML here"
              value={uploadDraft.html_content}
              onChange={(event) => setUploadDraft((current) => ({ ...current, html_content: event.target.value }))}
              className="min-h-[220px]"
            />

            <div className="rounded-[22px] border border-warning/20 bg-warning/5 p-4 text-sm leading-6 text-textSecondary">
              Upload only safe, self-contained HTML that you are comfortable sharing with the ReachIQ community.
              ReachIQ requires <code>{"{{BUSINESS_NAME}}"}</code>, <code>{"{{PHONE}}"}</code>, <code>{"{{ADDRESS}}"}</code>, and <code>{"{{CITY}}"}</code>.
              Tagline, services, and WhatsApp placeholders are optional. If you upload a file, only `.html` templates are supported.
            </div>

            <Button
              onClick={() => void handleUploadTemplate()}
              disabled={uploading || !uploadDraft.name || !uploadDraft.niche || (!uploadDraft.html_content && !uploadFile)}
            >
              {uploading ? "Uploading..." : "Upload template"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-textPrimary">Open template library</p>
            <Badge variant="muted">{templates.length} templates</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-textPrimary">{template.name}</p>
                    <p className="mt-1 text-sm text-textSecondary">{template.niche}</p>
                  </div>
                  <Badge variant="success">Open</Badge>
                </div>
                <p className="mt-3 line-clamp-5 text-xs leading-6 text-textMuted">{template.html_content}</p>
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => setForm((current) => ({ ...current, template_id: template.id }))}
                >
                  Use this template
                </Button>
              </div>
            ))}
          </div>
          {!templates.length ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <p className="text-base font-medium text-textPrimary">No website templates yet</p>
              <p className="max-w-sm text-sm leading-6 text-textSecondary">
                Upload the first template or ask an admin to seed the library with starter HTML templates.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-textPrimary">Generated websites</p>
            <Link href="/templates" className="text-sm text-textSecondary transition hover:text-textPrimary">
              Open message templates
            </Link>
          </div>
          {generated.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {generated.map((site) => (
                <div key={site.id} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-textPrimary">{site.business_name}</p>
                      <p className="mt-1 text-sm text-textSecondary">{site.address || site.phone || "Preview ready inside ReachIQ"}</p>
                    </div>
                    <Badge variant="success">Preview ready</Badge>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/8 bg-surface2 px-4 py-3 text-sm leading-6 text-textSecondary">
                    Hi! I built a free sample website for {site.business_name} - take a look: {site.live_url}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={site.live_url} target="_blank" rel="noreferrer">
                      <Button variant="secondary">Open preview</Button>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(site.live_url);
                        toast.success("Preview link copied");
                      }}
                      className="inline-flex items-center rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-textSecondary transition hover:border-primary/30 hover:text-textPrimary"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-8 text-sm text-textSecondary">
              No generated website previews yet. Create one above and ReachIQ will list it here with a live preview link.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
