"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductEditor } from "@/components/products-review";

/** One repurposed video on its own page: the video stays in view on the left, its products are on the right. */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Link href="/pipeline/products" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
        <ArrowLeft className="w-3.5 h-3.5" /> Product Clips
      </Link>
      <ProductEditor id={id} onChanged={() => {}} />
    </div>
  );
}
