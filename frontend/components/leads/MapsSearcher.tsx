"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type SearchResult = {
  name: string;
  phone: string;
  address: string;
  city: string;
  niche: string;
  website: string;
  has_website: boolean;
  rating?: number | null;
  reviews?: number | null;
  source: string;
  lat?: number | null;
  lng?: number | null;
};

type SearchResponse = {
  success: boolean;
  total: number;
  no_website_count: number;
  has_website_count: number;
  missing_phone_count?: number;
  results: SearchResult[];
  source: string;
  message: string;
};

export function MapsSearcher() {
  const router = useRouter();
  const [niches, setNiches] = useState<string[]>([]);
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [showWithWebsite, setShowWithWebsite] = useState(false);

  const hasContactablePhone = (value: string) => String(value || "").replace(/\D/g, "").length >= 10;

  useEffect(() => {
    api
      .get("/api/maps/niches")
      .then((response) => {
        const list = response.data?.niches || [];
        setNiches(list);
      })
      .catch(() => {
        setNiches([]);
      });
  }, []);

  const noWebsiteResults = useMemo(
    () => (results?.results || []).filter((item) => !item.has_website && hasContactablePhone(item.phone)),
    [results]
  );
  const missingPhoneNoWebsiteResults = useMemo(
    () => (results?.results || []).filter((item) => !item.has_website && !hasContactablePhone(item.phone)),
    [results]
  );
  const withWebsiteResults = useMemo(
    () => (results?.results || []).filter((item) => item.has_website),
    [results]
  );

  const handleSearch = async () => {
    if (!niche || !city.trim()) {
      toast.error("Please enter a niche and a city");
      return;
    }

    try {
      setLoading(true);
      setResults(null);
      const { data } = await api.post("/api/maps/search", {
        niche,
        city: city.trim(),
        limit: 30
      });
      setResults(data);
      toast.success(data.message);
    } catch (error: any) {
      const message =
        error?.response?.data?.details ||
        error?.response?.data?.error ||
        "Search failed. Try a different city name.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const addToLeads = async (businesses: SearchResult[]) => {
    try {
      const response = await api.post("/api/leads/bulk", {
        rows: businesses.map((item) => ({
          business_name: item.name,
          phone: item.phone,
          address: item.address,
          city: item.city,
          niche: item.niche,
          has_website: item.has_website,
          website_url: item.website || null,
          source: item.source
        }))
      });
      const count = Number(response.data?.count || 0);
      const message =
        response.data?.message ||
        `Added ${count} businesses to your leads. Go pitch them!`;
      toast.success(message);
      router.push("/leads");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to add leads");
    }
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-textPrimary">Find Businesses With No Website</h1>
        <p className="text-sm text-textSecondary">
          Search any city and ReachIQ will look for businesses that need your services. No setup required.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto]">
            <div className="space-y-2">
              <Input
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
                placeholder="Enter any niche (e.g. Dental Clinic, Gym, Hospital)"
                list="reachiq-niche-suggestions"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              <datalist id="reachiq-niche-suggestions">
                {niches.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <p className="text-xs text-textMuted">
                Type any niche you want. Suggestions are optional.
              </p>
            </div>
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Chennai, Coimbatore, Mumbai"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch} disabled={loading} className="min-w-[160px]">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="mt-5 text-base font-medium text-textPrimary">
              Searching for {niche || "businesses"} in {city || "your city"}...
            </p>
            <p className="mt-2 text-sm text-textSecondary">This takes about 10-15 seconds.</p>
          </CardContent>
        </Card>
      ) : null}

      {results ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
                    {results.no_website_count} ready-to-contact leads found
                  </span>
                  <span className="text-sm text-textSecondary">Source: {results.source.replaceAll("_", " ")}</span>
                </div>
                <p className="text-sm text-textSecondary">{results.message}</p>
                {missingPhoneNoWebsiteResults.length ? (
                  <p className="text-xs text-textMuted">
                    {missingPhoneNoWebsiteResults.length} more no-website businesses were found, but they are missing a phone number and were kept out of the campaign-ready list.
                  </p>
                ) : null}
              </div>
              <Button disabled={noWebsiteResults.length === 0} onClick={() => addToLeads(noWebsiteResults)}>
                Add All to Leads
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-textPrimary">No Website Found</p>
                   <p className="text-sm text-textSecondary">These are the best leads to pitch first because they have no website and a usable phone number.</p>
                </div>
                <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
                    {results.no_website_count} leads
                  </span>
                </div>

              <div className="space-y-3 md:hidden">
                {noWebsiteResults.length === 0 ? (
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-textSecondary">
                    No businesses without a website were found for this search.
                  </div>
                ) : (
                  noWebsiteResults.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                      <p className="font-medium text-textPrimary">{item.name}</p>
                      <p className="mt-2 text-sm text-textSecondary">{item.phone || "No phone saved"}</p>
                      <p className="mt-1 text-sm text-textSecondary">{item.address || item.city || "No address saved"}</p>
                      <Button variant="secondary" className="mt-4 w-full" onClick={() => addToLeads([item])}>
                        Add to Leads
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-border text-left text-textSecondary">
                    <tr>
                      <th className="px-3 py-2">Business Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Address</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noWebsiteResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center text-textSecondary">
                          No businesses without a website were found for this search.
                        </td>
                      </tr>
                    ) : (
                      noWebsiteResults.map((item, index) => (
                        <tr key={`${item.name}-${index}`} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-3 text-textPrimary">{item.name}</td>
                          <td className="px-3 py-3 text-textSecondary">{item.phone || "N/A"}</td>
                          <td className="px-3 py-3 text-textSecondary">{item.address || item.city || "N/A"}</td>
                          <td className="px-3 py-3">
                            <Button variant="secondary" onClick={() => addToLeads([item])}>
                              Add to Leads
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowWithWebsite((current) => !current)}
              >
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-textPrimary">Already Have a Website</p>
                  <p className="text-sm text-textSecondary">Useful for research, but lower priority for website pitching.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/8 px-3 py-1 text-sm font-medium text-textSecondary">
                    {results.has_website_count} already have websites
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-textSecondary transition-transform ${showWithWebsite ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {showWithWebsite ? (
                <>
                  <div className="space-y-3 md:hidden">
                    {withWebsiteResults.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                        <p className="font-medium text-textPrimary">{item.name}</p>
                        <p className="mt-2 text-sm text-textSecondary">{item.phone || "No phone saved"}</p>
                        <p className="mt-1 text-sm text-textSecondary">{item.address || item.city || "No address saved"}</p>
                        <p className="mt-3 text-sm text-primary">
                          {item.website ? (
                            <a href={item.website} target="_blank" rel="noreferrer" className="hover:underline">
                              View website
                            </a>
                          ) : (
                            "Listed as website owner"
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead className="border-b border-border text-left text-textSecondary">
                        <tr>
                          <th className="px-3 py-2">Business Name</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Address</th>
                          <th className="px-3 py-2">Website</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withWebsiteResults.map((item, index) => (
                          <tr key={`${item.name}-${index}`} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-3 text-textPrimary">{item.name}</td>
                            <td className="px-3 py-3 text-textSecondary">{item.phone || "N/A"}</td>
                            <td className="px-3 py-3 text-textSecondary">{item.address || item.city || "N/A"}</td>
                            <td className="px-3 py-3 text-primary">
                              {item.website ? (
                                <a href={item.website} target="_blank" rel="noreferrer" className="hover:underline">
                                  View website
                                </a>
                              ) : (
                                "Listed as website owner"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {missingPhoneNoWebsiteResults.length ? (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-textPrimary">Need Manual Phone Lookup</p>
                    <p className="text-sm text-textSecondary">These businesses look promising, but ReachIQ could not find a usable phone number yet.</p>
                  </div>
                  <span className="rounded-full bg-warning/15 px-3 py-1 text-sm font-medium text-warning">
                    {missingPhoneNoWebsiteResults.length} need research
                  </span>
                </div>

                <div className="space-y-3">
                  {missingPhoneNoWebsiteResults.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                      <p className="font-medium text-textPrimary">{item.name}</p>
                      <p className="mt-1 text-sm text-textSecondary">{item.address || item.city || "No address saved"}</p>
                      <p className="mt-2 text-sm text-warning">Phone number missing</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
