"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, LineChart, Pill, Plus, Smile, type LucideIcon } from "lucide-react";
import { MoodTagPicker } from "@/components/wellbeing/MoodTagPicker";
import { LogLevelModal, type LogLevelSubmitInput } from "@/components/wellbeing/LogLevelModal";
import { createStandaloneLog, medicationTracksMetric, type WellbeingMetric } from "@/lib/pain-mood";
import type { Medication } from "@/lib/types/medications";

interface QuickActionsPanelProps {
  medications: Medication[];
  activeProfileId?: string | null;
}

const NAV_ACTIONS = [
  { href: "/medications/new", label: "Add medication", icon: Plus, tint: "bg-brand-deep-blue" },
  { href: "/medications", label: "Manage medications", icon: Pill, tint: "bg-brand-blue" },
];

const LOG_ACTIONS: Array<{
  metric: WellbeingMetric;
  label: string;
  icon: LucideIcon;
  tint: string;
}> = [
  { metric: "pain", label: "Pain tracking", icon: LineChart, tint: "bg-status-warning" },
  { metric: "mood", label: "Mood & Wellbeing", icon: Smile, tint: "bg-brand-cyan" },
];

export function QuickActionsPanel({ medications, activeProfileId }: QuickActionsPanelProps) {
  const queryClient = useQueryClient();
  const [activeMetric, setActiveMetric] = useState<WellbeingMetric | null>(null);

  const trackedMedications = useMemo(
    () => medications.filter((medication) => activeMetric && medicationTracksMetric(activeMetric, medication)),
    [activeMetric, medications],
  );

  const logMutation = useMutation({
    mutationFn: (input: LogLevelSubmitInput) => {
      if (!activeMetric) throw new Error("Choose pain or mood before saving.");
      return createStandaloneLog({
        medicationId: input.medicationId,
        logType: activeMetric,
        painLevel: activeMetric === "pain" ? input.level : null,
        moodLevel: activeMetric === "mood" ? input.level : null,
        note: input.note,
        tags: input.tags.join(","),
        loggedAt: input.loggedAt,
        profileId: activeProfileId,
      });
    },
    onSuccess: () => {
      if (!activeMetric) return;
      toast.success(`${activeMetric === "pain" ? "Pain" : "Mood"} level logged`);
      queryClient.invalidateQueries({ queryKey: ["wellbeing-trend", activeMetric] });
      queryClient.invalidateQueries({ queryKey: ["wellbeing-history", activeMetric] });
      setActiveMetric(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save log");
    },
  });

  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
      <h3 className="mb-2 font-bold text-brand-navy">Quick actions</h3>
      <div className="flex flex-col">
        <QuickActionLink
          href={NAV_ACTIONS[0].href}
          label={NAV_ACTIONS[0].label}
          icon={NAV_ACTIONS[0].icon}
          tint={NAV_ACTIONS[0].tint}
        />
        {LOG_ACTIONS.map(({ metric, label, icon, tint }) => (
          <QuickActionButton
            key={metric}
            label={label}
            icon={icon}
            tint={tint}
            onClick={() => setActiveMetric(metric)}
          />
        ))}
        <QuickActionLink
          href={NAV_ACTIONS[1].href}
          label={NAV_ACTIONS[1].label}
          icon={NAV_ACTIONS[1].icon}
          tint={NAV_ACTIONS[1].tint}
        />
      </div>

      {activeMetric && (
        <LogLevelModal
          metric={activeMetric}
          medications={trackedMedications}
          open
          onOpenChange={(open) => {
            if (!open) setActiveMetric(null);
          }}
          trigger={null}
          onSubmit={(input) => logMutation.mutate(input)}
          renderTagPicker={
            activeMetric === "mood"
              ? (selected, onChange) => <MoodTagPicker selected={selected} onChange={onChange} />
              : undefined
          }
        />
      )}
    </div>
  );
}

function QuickActionLink({
  href,
  label,
  icon: Icon,
  tint,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 border-b border-brand-border py-2.5 last:border-0 hover:opacity-80"
    >
      <QuickActionIcon icon={Icon} tint={tint} />
      <span className="flex-1 text-sm font-medium text-brand-text">{label}</span>
      <ChevronRight size={16} className="text-brand-text-muted" />
    </Link>
  );
}

function QuickActionButton({
  label,
  icon: Icon,
  tint,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-brand-border py-2.5 text-left last:border-0 hover:opacity-80"
    >
      <QuickActionIcon icon={Icon} tint={tint} />
      <span className="flex-1 text-sm font-medium text-brand-text">{label}</span>
      <ChevronRight size={16} className="text-brand-text-muted" />
    </button>
  );
}

function QuickActionIcon({
  icon: Icon,
  tint,
}: {
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${tint}`}>
      <Icon size={16} />
    </span>
  );
}
