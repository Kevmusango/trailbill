import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a YYYY-MM-DD date string as DD/MM/YYYY */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

/** Format an ISO timestamp as DD/MM/YYYY in SAST (Africa/Johannesburg) */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Africa/Johannesburg" });
}

/**
 * Normalizes a Supabase Storage logo URL to always use the public endpoint.
 * Fixes URLs stored without the required /public/ segment:
 *   .../storage/v1/object/business-logos/...
 *   → .../storage/v1/object/public/business-logos/...
 */
export function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(
    /\/storage\/v1\/object\/(?!public\/)business-logos\//,
    "/storage/v1/object/public/business-logos/"
  );
}
