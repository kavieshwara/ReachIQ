"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function PaginationControls({
  pagination,
  onChange
}: {
  pagination?: Pagination | null;
  onChange: (page: number) => void;
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/6 px-5 py-4">
      <p className="text-sm text-textSecondary">
        Page {pagination.page} of {pagination.totalPages} • {pagination.total} records
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="h-10 px-3"
          disabled={pagination.page <= 1}
          onClick={() => onChange(pagination.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          className="h-10 px-3"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onChange(pagination.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
