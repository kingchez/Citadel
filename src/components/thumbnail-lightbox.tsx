"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface ThumbnailLightboxProps {
  images: string[];
  startIndex: number;
  selectedUrl?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function ThumbnailLightbox({ images, startIndex, selectedUrl, onClose, onSelect }: ThumbnailLightboxProps) {
  const [index, setIndex] = useState(startIndex);

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const goNext = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, onClose]);

  const current = images[index];
  const isSelected = current === selectedUrl;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 btn-ghost p-2 text-white hover:bg-white/10" aria-label="Close">
        <X className="w-6 h-6" />
      </button>

      <div className="w-full max-w-3xl flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full flex items-center justify-center">
          {images.length > 1 && (
            <button
              onClick={goPrev}
              className="absolute left-0 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              aria-label="Previous thumbnail"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div className="rounded-xl overflow-hidden border-2 max-h-[70vh]" style={{ borderColor: isSelected ? "var(--color-purple)" : "transparent" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt={`Thumbnail ${index + 1} of ${images.length}`} className="max-h-[70vh] object-contain" />
          </div>

          {images.length > 1 && (
            <button
              onClick={goNext}
              className="absolute right-0 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              aria-label="Next thumbnail"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70">
            {index + 1} of {images.length}
          </span>
          <button
            onClick={() => onSelect(current)}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-sm font-semibold transition-colors ${
              isSelected ? "bg-[var(--color-green)] text-white" : "bg-[var(--color-purple)] text-white hover:opacity-90"
            }`}
          >
            {isSelected ? <Check className="w-4 h-4" /> : null}
            {isSelected ? "Selected" : "Select this thumbnail"}
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            {images.map((url, i) => (
              <button
                key={url}
                onClick={() => setIndex(i)}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-16 h-16 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
