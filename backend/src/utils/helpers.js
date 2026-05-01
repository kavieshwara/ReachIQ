import Papa from "papaparse";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

export function normalizeWhatsAppPhone(phone) {
  return sanitizePhone(phone).replace(/^00/, "");
}

export function interpolateTemplate(template, lead) {
  const replacements = {
    "{{name}}": lead.business_name || lead.businessName || "",
    "{{business}}": lead.business_name || lead.businessName || "",
    "{{phone}}": lead.phone || "",
    "{{city}}": lead.city || "",
    "{{address}}": lead.address || ""
  };

  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(key, value),
    String(template || "")
  );
}

export function csvBufferToRows(buffer) {
  const content = buffer.toString("utf8");
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

export function toCsv(rows) {
  return Papa.unparse(rows);
}

export function paginate(page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  return { page: safePage, pageSize: safePageSize, from, to };
}

export function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

export function formatApiError(error, fallbackMessage = "Something went wrong") {
  const message =
    error?.response?.data?.error?.message ||
    error?.message ||
    fallbackMessage;
  return { message };
}

export function isAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
}

export function withTimestampError(prefix, error) {
  console.error(`[${new Date().toISOString()}] ${prefix}`, error);
}

export function buildPaginationPayload(count, page, pageSize) {
  return {
    page,
    pageSize,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / pageSize))
  };
}
