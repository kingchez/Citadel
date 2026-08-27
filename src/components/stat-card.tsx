"use client";

import Link from "next/link";
import { Film, AlertTriangle, Clock, ClipboardCheck, CheckCircle } from "lucide-react";
import type { StatusColor } from "@/lib/types";

const iconComponents = {
  Film,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  CheckCircle,
};

const colorVars: Record<StatusColor, { glow: string; iconBg: string }> = {
  purple: { glow: "var(--color-purple)", iconBg: "var(--color-purple-soft)" },
  cyan: { glow: "var(--color-cyan)", iconBg: "var(--color-cyan-soft)" },
  green: { glow: "var(--color-green)", iconBg: "var(--color-green-soft)" },
  amber: { glow: "var(--color-amber)", iconBg: "var(--color-amber-soft)" },
  red: { glow: "var(--color-red)", iconBg: "var(--color-red-soft)" },
};

interface StatCardProps {
  title: string;
  value: number | string;
  icon: keyof typeof iconComponents;
  color: StatusColor;
  link?: string;
}

export function StatCard({ title, value, icon, color, link }: StatCardProps) {
  const config = colorVars[color];
  const Icon = iconComponents[icon] || Film;

  const cardContent = (
    <div className="stat-card card p-5 relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text)] tabular-nums">{value}</span>
          </div>
        </div>
        <div className="p-3 rounded-xl flex-shrink-0" style={{ backgroundColor: config.iconBg }}>
          <Icon className="w-6 h-6" style={{ color: config.glow }} />
        </div>
      </div>

      {link && (
        <Link
          href={link}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)]"
          aria-label={`View ${title}`}
        />
      )}
    </div>
  );

  return <div>{cardContent}</div>;
}
