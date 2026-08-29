// Colored badge banding for 1-10 pain/mood scores, per the style guide's
// 4-tier scheme. Pain severity climbs with the number (green → red);
// mood is the inverse — a high mood score is good news, so its color
// scale runs the opposite direction (red → green) even though the
// numeric bands are the same width.
const SUCCESS = "bg-status-success/10 text-status-success";
const WARNING = "bg-status-warning/10 text-status-warning";
const ORANGE = "bg-orange-500/10 text-orange-600";
const DANGER = "bg-status-danger/10 text-status-danger";

export function painBandStyle(level: number): string {
  if (level <= 3) return SUCCESS;
  if (level <= 6) return WARNING;
  if (level <= 8) return ORANGE;
  return DANGER;
}

export function painBandLabel(level: number): string {
  if (level <= 3) return "Low";
  if (level <= 6) return "Moderate";
  if (level <= 8) return "High";
  return "Severe";
}

export function moodBandStyle(level: number): string {
  if (level <= 3) return DANGER;
  if (level <= 6) return ORANGE;
  if (level <= 8) return WARNING;
  return SUCCESS;
}

export function moodBandLabel(level: number): string {
  if (level <= 3) return "Poor";
  if (level <= 6) return "Fair";
  if (level <= 8) return "Good";
  return "Great";
}
