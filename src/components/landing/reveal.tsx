"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Marks a below-the-fold block as "in" once it reaches 85% of the viewport,
 * once. The hidden starting state lives in globals.css under `html.js` and
 * `prefers-reduced-motion: no-preference`, so without JS (or with reduced
 * motion) the content is simply there.
 */
export function Reveal({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "figure" | "ul";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-reveal
      data-in={inView}
      className={cn(className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
