"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-brand-border transition-colors",
        "data-[state=checked]:bg-brand-blue",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform",
          "data-[state=checked]:translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
