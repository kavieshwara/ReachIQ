"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LeadTable } from "@/components/leads/LeadTable";
import { CSVUploader } from "@/components/leads/CSVUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [filters, setFilters] = useState({ search: "", niche: "", status: "", hasWebsite: "" });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const { data } = await api.get("/api/leads", { params: { page: 1, pageSize: 20, ...filters } });
      setLeads(data.data || []);
    } catch (error: any) {
      console.error("[ReachIQ][leads] failed to load leads", error);
      setErrorMessage(error?.response?.data?.error || "Leads could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr,1fr,1fr,auto]">
        <Input placeholder="Search by business or city" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        <Select value={filters.niche} onChange={(event) => setFilters((current) => ({ ...current, niche: event.target.value }))}>
          <option value="">All niches</option>
          <option value="dental">Dental</option>
          <option value="restaurant">Restaurant</option>
          <option value="gym">Gym</option>
          <option value="salon">Salon</option>
        </Select>
        <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="converted">Converted</option>
        </Select>
        <Select value={filters.hasWebsite} onChange={(event) => setFilters((current) => ({ ...current, hasWebsite: event.target.value }))}>
          <option value="">All websites</option>
          <option value="false">No website</option>
          <option value="true">Has website</option>
        </Select>
        <Button onClick={() => load().catch(() => toast.error("Could not load leads"))}>Apply</Button>
      </div>
      {errorMessage ? (
        <div className="rounded-[24px] border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-textSecondary">
          {errorMessage}
        </div>
      ) : null}
      <CSVUploader />
      {loading ? (
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-textSecondary">
          Loading leads...
        </div>
      ) : null}
      <LeadTable
        leads={loading ? [] : leads}
        onDelete={async (id) => {
          await api.delete(`/api/leads/${id}`);
          toast.success("Lead deleted");
          load().catch(() => null);
        }}
      />
    </div>
  );
}
