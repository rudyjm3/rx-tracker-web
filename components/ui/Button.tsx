import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-opacity disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-gradient-brand text-white shadow-card hover:opacity-90",
        secondary:
          "border border-brand-border bg-white text-brand-navy hover:bg-brand-bg",
        ghost: "text-brand-deep-blue hover:bg-brand-bg",
      },
      size: {
        default: "px-4 py-2.5 text-sm",
        compact: "px-2 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
