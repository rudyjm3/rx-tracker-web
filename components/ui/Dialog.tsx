"use client";

import { Children, Fragment, isValidElement, useRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

// Flattens one level of React Fragments (e.g. `{cond && <>...</>}`) so
// DialogHeader can be found even when a caller wraps its dialog body in a
// conditional fragment, without recursing into every other element type.
function flattenFragments(nodes: ReactNode[]): ReactNode[] {
  return nodes.flatMap((node) =>
    isValidElement(node) && node.type === Fragment
      ? flattenFragments(Children.toArray((node.props as { children?: ReactNode }).children))
      : [node],
  );
}

export function DialogContent({
  className,
  children,
  size = "default",
  sheet = false,
  onSheetDismiss,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: "default" | "wide";
  // Opt-in: below 640px render as a bottom sheet (slides up, drag handle,
  // <=85dvh, scrolls internally); wider screens keep the centered modal.
  // Backdrop tap, Escape and body scroll lock come from Radix either way.
  sheet?: boolean;
  onSheetDismiss?: () => void;
}) {
  const dragStartY = useRef<number | null>(null);
  // Pull DialogHeader out of the scrollable flow: it renders first, outside
  // (and unaffected by) the scroll container, per the fixed-header/
  // scrollable-body dialog layout — everything else (the form fields,
  // footer, etc.) scrolls beneath it.
  const childArray = flattenFragments(Children.toArray(children));
  const headerChild = childArray.find(
    (child) => isValidElement(child) && child.type === DialogHeader,
  );
  const restChildren = headerChild ? childArray.filter((child) => child !== headerChild) : childArray;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-dark-navy/50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-hero bg-brand-card shadow-card focus:outline-none",
          size === "wide" ? "max-w-2xl" : "max-w-md",
          sheet &&
            "sheet-enter max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[85dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:animate-[sheet-up_220ms_ease-out] max-sm:rounded-b-none max-sm:rounded-t-hero",
          className,
        )}
        {...props}
      >
        {sheet && (
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 sm:hidden"
            aria-hidden="true"
            onPointerDown={(e) => {
              dragStartY.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              if (dragStartY.current !== null && e.clientY - dragStartY.current > 60) {
                onSheetDismiss?.();
              }
              dragStartY.current = null;
            }}
            onPointerCancel={() => {
              dragStartY.current = null;
            }}
          >
            <span className="h-1.5 w-10 rounded-full bg-brand-border" />
          </div>
        )}
        {headerChild && (
          <div className={cn("shrink-0 px-6 pb-3 pt-6", sheet && "max-sm:pt-2")}>{headerChild}</div>
        )}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 pb-6",
            !headerChild && "pt-6",
            sheet && "max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          )}
        >
          {restChildren}
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 z-20 text-brand-text-muted hover:text-brand-text">
          <X size={18} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-bold text-brand-navy", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex justify-end gap-2", className)}
      {...props}
    />
  );
}
