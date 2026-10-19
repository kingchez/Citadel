import type { MatchStatus } from "./product-text";

export type { MatchStatus };

/** One product the AI found in the pasted script. */
export interface ExtractedProduct {
  name: string;
  /** A short snippet of the script around where it was mentioned, so you can tell which one it is. */
  mention: string;
}

/** One possible store listing for a script product. */
export interface MatchCandidate {
  key: string;
  title: string;
  site_label: string;
  /** Every site that listed this same Amazon product. */
  sites: string[];
  score: number;
  /** The site's own link, kept so a link that couldn't be resolved can still be opened by hand. */
  href: string;
  asin: string | null;
  /** The full Amazon URL the site's link ended at. */
  amazon_url: string | null;
  /** https://www.amazon.com/dp/ASIN - what ends up in the Affiliate products box. */
  clean_url: string | null;
  resolve_error?: string;
}

export interface MatchAi {
  choice: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface MatchResponse {
  status: MatchStatus;
  candidates: MatchCandidate[];
  /** The candidate key to pre-select (best match, or the AI's pick). null = nothing safe to pre-select. */
  suggested: string | null;
  ai: MatchAi | null;
  ai_error?: string;
  catalog_size: number;
  /** Sites that had never been read and were read just now for this search. */
  warnings: string[];
}
