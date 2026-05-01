"use client";

import Papa from "papaparse";
import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export function CSVUploader() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: ({ data }) => {
        setPreview((data as any[]).slice(0, 10));
      }
    });

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/api/leads/bulk", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      toast.success(`${data?.count || "All"} leads imported successfully`);
    } catch (error: any) {
      console.error("[ReachIQ][leads] CSV upload failed", error);
      toast.error(error?.response?.data?.error || "CSV upload failed. Please check the file format and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-textPrimary">CSV importer</p>
            <p className="text-sm text-textSecondary">Expected columns: Name, Phone, Address, City, Niche, Website</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(event) => onFile(event.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
        {preview.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface2 text-left text-textSecondary">
                <tr>
                  {Object.keys(preview[0]).map((key) => (
                    <th className="px-3 py-2" key={key}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {Object.keys(preview[0]).map((key) => (
                      <td key={key} className="px-3 py-2 text-textSecondary">
                        {String(row[key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
