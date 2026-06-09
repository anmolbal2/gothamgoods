"use client";

import { useCallback, useEffect, useState } from "react";

function Arrow({
  dir,
  onClick,
  light,
}: {
  dir: "l" | "r";
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={dir === "l" ? "Previous photo" : "Next photo"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full leading-none ${
        light
          ? "h-12 w-12 bg-ink/70 text-3xl text-white ring-1 ring-white/40 backdrop-blur hover:bg-ink/90"
          : "h-9 w-9 bg-ink/70 text-2xl text-cream hover:bg-ink"
      } ${dir === "l" ? "left-2 sm:left-4" : "right-2 sm:right-4"}`}
    >
      {dir === "l" ? "‹" : "›"}
    </button>
  );
}

/**
 * Per-color photo carousel + click-to-expand lightbox. Stands in for product pages.
 * Reset to the first photo on color change by passing key={color.name} at the call site.
 */
export default function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const n = images.length;
  const multi = n > 1;

  const go = useCallback(
    (d: number) => setIdx((i) => (i + d + n) % n),
    [n],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, go]);

  if (n === 0) return <div className="aspect-square w-full" />;

  return (
    <>
      {/* Inline carousel */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Expand photo"
          className="block w-full cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[idx]}
            alt={alt}
            loading="lazy"
            className="mx-auto aspect-square w-full max-w-[300px] object-contain"
          />
        </button>
        {multi && (
          <>
            <Arrow dir="l" onClick={() => go(-1)} />
            <Arrow dir="r" onClick={() => go(1)} />
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-4 bg-ink" : "w-1.5 bg-ink/30 hover:bg-ink/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/95 p-4"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/25"
          >
            ✕
          </button>
          {multi && (
            <>
              <Arrow dir="l" light onClick={() => go(-1)} />
              <Arrow dir="r" light onClick={() => go(1)} />
            </>
          )}
          <div
            className="relative flex max-w-3xl items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[idx]}
              alt={alt}
              onClick={(e) => {
                if (!multi) return;
                e.stopPropagation();
                go(1);
              }}
              className={`max-h-[85vh] w-auto rounded-lg bg-white object-contain ${
                multi ? "cursor-pointer" : ""
              }`}
            />
          </div>
          {multi && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-xs uppercase tracking-widest text-white/70">
              {idx + 1} / {n}
            </div>
          )}
        </div>
      )}
    </>
  );
}
