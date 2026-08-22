"use client";

import { WellbeingClient } from "./WellbeingClient";
import { MoodTagPicker } from "./MoodTagPicker";

export function MoodWellbeingClient() {
  return (
    <WellbeingClient
      metric="mood"
      title="Mood & Wellbeing"
      renderTagPicker={(selected, onChange) => (
        <MoodTagPicker selected={selected} onChange={onChange} />
      )}
    />
  );
}
