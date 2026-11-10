export type ArticleStatus =
  | "planning"
  | "researching"
  | "review_ready"
  | "revision_requested"
  | "approved"
  | "publishing"
  | "published"
  | "archived";

export interface ArticleProduct {
  asin: string;
  title: string;
  price?: string | null;
  extracted_price?: number | null;
  rating?: number | null;
  review_count?: number | null;
  url?: string | null;
  sponsored?: boolean;
  bought_last_month?: string | null;
  clip?: "pending" | "done" | "error" | "exists" | "none";
  Exist?: string | number | false | null;
}

export interface ArticleRevisionEntry {
  id: string;
  note: string;
  status: "pending" | "resolved";
  created_at: string;
  resolved_at?: string | null;
}

export interface ArticleSeoMetadata {
  focus_keyword?: string;
  secondary_keywords?: string[];
  meta_description?: string;
  schema_json?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ArticleSocialMetadata {
  x_post?: string;
  threads_post?: string;
  pinterest_pin?: {
    title?: string;
    description?: string;
    board?: string;
  };
  facebook_post?: string;
  [key: string]: unknown;
}

export interface ArticleRow {
  id: string;
  topic_id?: string | null;
  channel: string;
  category?: string | null;
  status: ArticleStatus;
  title: string;
  slug: string;
  body_html: string;
  product_ids: ArticleProduct[];
  thumbnail_drive_file_id?: string | null;
  thumbnail_drive_url?: string | null;
  wordpress_media_id?: number | null;
  seo_metadata: ArticleSeoMetadata;
  social_metadata: ArticleSocialMetadata;
  revision_history: ArticleRevisionEntry[];
  notes?: Record<string, unknown> | null;
  wordpress_post_id?: number | null;
  wordpress_url?: string | null;
  scheduled_for?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentTopicRow {
  id: string;
  channel: string;
  category?: string | null;
  topic_title: string;
  target_keywords?: string[];
  target_week?: string | null;
  notes?: string | null;
  status: "proposed" | "approved" | "in_progress" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  planning: "Planning",
  researching: "Researching",
  review_ready: "Needs Review",
  revision_requested: "Revision Requested",
  approved: "Approved",
  publishing: "Publishing",
  published: "Published",
  archived: "Archived",
};

export type ArticleStatusColor = "purple" | "cyan" | "green" | "amber" | "red" | "gray";

export const ARTICLE_STATUS_COLORS: Record<ArticleStatus, ArticleStatusColor> = {
  planning: "purple",
  researching: "cyan",
  review_ready: "amber",
  revision_requested: "red",
  approved: "purple",
  publishing: "cyan",
  published: "green",
  archived: "gray",
};
