"use client";

import { cn } from "@/lib/utils";
import type { ArticleStatus } from "@/lib/article-types";
import { ARTICLE_STATUS_LABELS, ARTICLE_STATUS_COLORS } from "@/lib/article-types";
import {
  FileText,
  Search,
  ClipboardCheck,
  MessageSquareWarning,
  Sparkles,
  Eye,
  CheckCircle2,
  Send,
  Globe,
  Clock,
  Archive,
} from "lucide-react";

const statusIcons: Record<ArticleStatus, React.ElementType> = {
  planning: FileText,
  researching: Search,
  review_ready: ClipboardCheck,
  revision_requested: MessageSquareWarning,
  canva_ready: Sparkles,
  final_review: Eye,
  approved: CheckCircle2,
  publishing: Send,
  published: Globe,
  scheduled: Clock,
  archived: Archive,
};

interface ArticleStatusBadgeProps {
  status: ArticleStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function ArticleStatusBadge({
  status,
  size = "md",
  showIcon = true,
  className,
}: ArticleStatusBadgeProps) {
  const label = ARTICLE_STATUS_LABELS[status] ?? status;
  const color = ARTICLE_STATUS_COLORS[status] ?? "purple";
  const Icon = statusIcons[status] ?? FileText;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  const iconSize = { sm: "w-3 h-3", md: "w-3.5 h-3.5", lg: "w-4 h-4" };

  return (
    <span className={cn("badge", `badge-${color}`, sizeClasses[size], className)}>
      {showIcon && (
        <span className="flex-shrink-0">
          <Icon className={iconSize[size]} />
        </span>
      )}
      <span className="whitespace-nowrap normal-case tracking-normal font-semibold">
        {label}
      </span>
    </span>
  );
}
