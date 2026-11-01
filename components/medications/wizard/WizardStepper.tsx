"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface WizardStepperProps {
  labels: string[];
  /** 1-based current step. */
  step: number;
  /** 1-based furthest step the user has reached (and validated up to). */
  furthestStep: number;
  onSelect: (step: number) => void;
}

// A step is complete once the user has validly moved past it. The step they
// are currently on is never "complete" — it shows the active ring.
export function WizardStepper({ labels, step, furthestStep, onSelect }: WizardStepperProps) {
  return (
    <nav aria-label="Add medication progress" className="mb-6">
      <ol className="flex">
        {labels.map((label, i) => {
          const n = i + 1;
          const isActive = n === step;
          const isComplete = n < furthestStep;
          // Back is always allowed; forward only to steps already reached.
          const reachable = n <= Math.max(furthestStep, step);
          const lineFilled = n < furthestStep;
          return (
            <li key={label} className="relative flex-1">
              {i < labels.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-brand-border"
                >
                  <span
                    className="block h-full bg-gradient-brand transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: lineFilled ? "100%" : "0%" }}
                  />
                </span>
              )}
              <button
                type="button"
                onClick={() => reachable && !isActive && onSelect(n)}
                disabled={!reachable}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "relative z-10 flex w-full flex-col items-center gap-1 rounded-md py-1",
                  reachable && !isActive ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300",
                    isActive
                      ? "bg-gradient-brand text-white ring-4 ring-brand-bg"
                      : isComplete
                        ? "bg-brand-deep-blue text-white"
                        : "border border-brand-border bg-brand-card text-brand-text-muted",
                  )}
                >
                  {isComplete && !isActive ? <Check className="h-4 w-4" aria-hidden /> : n}
                  {isComplete && !isActive && <span className="sr-only">(completed)</span>}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    isActive || isComplete ? "text-brand-text" : "text-brand-text-muted",
                    isActive && "font-semibold",
                  )}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
