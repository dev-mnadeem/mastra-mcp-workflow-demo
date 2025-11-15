import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-[#dcefe6] text-[#11543f]",
  danger: "bg-[#f7e0dc] text-[#8a2216]",
  info: "bg-[#e1ebee] text-[#1d4f5e]",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] leading-4",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
