"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", niche: "", content: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const { data } = await api.get("/api/templates");
      setTemplates([...(data.systemTemplates || []), ...(data.userTemplates || [])]);
    } catch (error: any) {
      console.error("[ReachIQ][templates] failed to load templates", error);
      setErrorMessage(error?.response?.data?.error || "Templates could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,360px]">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2 border-white/8 bg-white/[0.03]">
          <CardContent className="flex flex-col gap-3 p-5 text-sm text-textSecondary md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-textPrimary">Message templates drive the campaign tone.</p>
              <p className="mt-1">
                Start with the built-in niche templates, then edit your own version so every campaign feels more personal and less robotic.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs text-primary">
              Variables supported: {"{{name}}"}, {"{{business}}"}, {"{{city}}"}, {"{{phone}}"}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 border-white/8 bg-white/[0.02]">
          <CardContent className="space-y-3 p-5 text-sm leading-6 text-textSecondary">
            <p className="font-medium text-textPrimary">Template writing guide for users</p>
            <ul className="space-y-2">
              <li>Write one short WhatsApp opener, not a long sales paragraph.</li>
              <li>Use the variables exactly as shown so ReachIQ can replace them per lead.</li>
              <li>Mention the niche benefit clearly, for example more bookings, more enquiries, or better trust.</li>
              <li>Avoid raw links in the base template if you want the AI to send video-first outreach.</li>
              <li>Save different templates for different niches like cafe, dental clinic, real estate, or showroom.</li>
            </ul>
          </CardContent>
        </Card>

        {errorMessage ? (
          <Card className="md:col-span-2 border-danger/30 bg-danger/8">
            <CardContent className="space-y-3 p-5">
              <p className="text-sm text-textSecondary">{errorMessage}</p>
              <Button variant="secondary" onClick={() => load().catch(() => null)}>
                Retry templates
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {loading ? (
          <Card className="md:col-span-2 border-white/8 bg-white/[0.03]">
            <CardContent className="p-5 text-sm text-textSecondary">
              Loading ReachIQ templates...
            </CardContent>
          </Card>
        ) : null}
        {!loading && !errorMessage && templates.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="p-6 text-sm text-textSecondary">
              You do not have any saved templates yet. Start with one on the right, or use the built-in system templates when they load.
            </CardContent>
          </Card>
        ) : null}
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-textPrimary">{template.name}</p>
                <span className="text-xs uppercase tracking-[0.2em] text-textMuted">{template.niche}</span>
              </div>
              <p className="line-clamp-5 text-sm leading-6 text-textSecondary">{template.content}</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const nicheQuery = template.niche ? `&niche=${encodeURIComponent(template.niche)}` : "";
                    router.push(`/campaigns/new?templateId=${encodeURIComponent(template.id)}${nicheQuery}`);
                  }}
                >
                  Use in Campaign
                </Button>
                {!String(template.id).startsWith("system-") ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(template.id);
                        setDraft({
                          name: template.name || "",
                          niche: template.niche || "",
                          content: template.content || ""
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await api.delete(`/api/templates/${template.id}`);
                          toast.success("Template deleted");
                          if (editingId === template.id) {
                            setEditingId(null);
                            setDraft({ name: "", niche: "", content: "" });
                          }
                          await load();
                        } catch (error: any) {
                          console.error("[ReachIQ][templates] failed to delete template", error);
                          toast.error(error?.response?.data?.error || "Template could not be deleted right now.");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold text-textPrimary">{editingId ? "Edit template" : "New template"}</p>
            {editingId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft({ name: "", niche: "", content: "" });
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
          <Input placeholder="Template name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          <Input placeholder="Niche tag" value={draft.niche} onChange={(event) => setDraft((current) => ({ ...current, niche: event.target.value }))} />
          <Textarea placeholder="Write your template using {{name}}, {{business}}, {{city}}, {{phone}}" value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} />
          <p className="text-xs text-textSecondary">{draft.content.length} characters</p>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!draft.name.trim() || !draft.niche.trim() || !draft.content.trim()) {
                toast.error("Add a template name, niche, and message before saving.");
                return;
              }

              try {
                setSaving(true);
                const payload = {
                  ...draft,
                  variables: ["{{name}}", "{{business}}", "{{city}}", "{{phone}}"]
                };
                if (editingId) {
                  await api.patch(`/api/templates/${editingId}`, payload);
                } else {
                  await api.post("/api/templates", payload);
                }
                toast.success(editingId ? "Template updated" : "Template saved");
                setEditingId(null);
                setDraft({ name: "", niche: "", content: "" });
                await load();
              } catch (error: any) {
                console.error("[ReachIQ][templates] failed to save template", error);
                toast.error(error?.response?.data?.error || "Template could not be saved right now.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : editingId ? "Update template" : "Save template"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
