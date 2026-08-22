import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

// Numeric fields are kept as plain strings in the form model — matching
// what an <input type="number"> actually produces via register() — and
// converted to real numbers only at the DB-mapping boundary in
// WizardShell. This sidesteps a z.coerce.number()/zodResolver generic
// mismatch: coercing inside the schema makes an empty "" input become 0
// (defeating .optional()) and, once patched with z.preprocess, breaks
// useForm's type inference between the schema's input and output types.
function isPositiveNumberString(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

const scheduleTimeSchema = z.object({
  reminderTime: z.string().regex(timePattern, "Enter a valid time"),
  quantityPerDose: z
    .string()
    .optional()
    .refine((v) => !v || isPositiveNumberString(v), "Must be a positive number"),
});

export const medicationFormSchema = z
  .object({
    // Step 1 — Identity
    name: z.string().min(1, "Name is required"),
    doseAmount: z
      .string()
      .optional()
      .refine((v) => !v || isPositiveNumberString(v), "Must be a positive number"),
    doseUnit: z.string().optional(),
    doseForm: z.string().optional(),
    instructions: z.string().optional(),
    medicationType: z.enum(["prescription", "otc", "supplement"]),

    // Step 2 — Schedule
    asNeeded: z.boolean(),
    scheduleMode: z.enum(["fixed_times", "interval"]),
    scheduleTimes: z.array(scheduleTimeSchema),
    intervalHours: z.string().optional(),
    firstDoseTime: z
      .string()
      .optional()
      .refine((v) => !v || timePattern.test(v), "Enter a valid time"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),

    // Step 3 — Inventory
    inventoryEnabled: z.boolean(),
    inventoryType: z.string(),
    inventoryUnit: z.string(),
    startingQuantity: z
      .string()
      .optional()
      .refine(
        (v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0),
        "Must be zero or greater",
      ),
    quantityPerDose: z
      .string()
      .refine(isPositiveNumberString, "Must be a positive number"),
    lowSupplyThreshold: z
      .string()
      .refine(
        (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
        "Must be zero or greater",
      ),

    // Step 4 — Feedback
    feedbackType: z.enum(["none", "pain", "mood", "both"]),
    dashboardEnabled: z.boolean(),
    remindersEnabled: z.boolean(),
    adherenceEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.asNeeded) return;

    if (data.scheduleMode === "fixed_times" && data.scheduleTimes.length === 0) {
      ctx.addIssue({
        path: ["scheduleTimes"],
        code: "custom",
        message: "Add at least one reminder time",
      });
    }

    if (data.scheduleMode === "interval") {
      if (!data.intervalHours || !isPositiveNumberString(data.intervalHours)) {
        ctx.addIssue({
          path: ["intervalHours"],
          code: "custom",
          message: "Required",
        });
      }
      if (!data.firstDoseTime) {
        ctx.addIssue({
          path: ["firstDoseTime"],
          code: "custom",
          message: "Required",
        });
      }
    }

    if (data.inventoryEnabled && !data.startingQuantity) {
      ctx.addIssue({
        path: ["startingQuantity"],
        code: "custom",
        message: "Required when tracking inventory",
      });
    }
  });

export type MedicationFormValues = z.infer<typeof medicationFormSchema>;

export const defaultFormValues: MedicationFormValues = {
  name: "",
  doseAmount: "",
  doseUnit: "",
  doseForm: "",
  instructions: "",
  medicationType: "prescription",

  asNeeded: false,
  scheduleMode: "fixed_times",
  scheduleTimes: [],
  intervalHours: "",
  firstDoseTime: "",
  startDate: "",
  endDate: "",

  inventoryEnabled: false,
  inventoryType: "pills",
  inventoryUnit: "tablets",
  startingQuantity: "",
  quantityPerDose: "1",
  lowSupplyThreshold: "5",

  feedbackType: "none",
  dashboardEnabled: true,
  remindersEnabled: true,
  adherenceEnabled: true,
};

export const STEP_FIELDS: Record<number, (keyof MedicationFormValues)[]> = {
  1: ["name", "doseAmount", "doseUnit", "doseForm", "instructions", "medicationType"],
  2: [
    "asNeeded",
    "scheduleMode",
    "scheduleTimes",
    "intervalHours",
    "firstDoseTime",
    "startDate",
    "endDate",
  ],
  3: [
    "inventoryEnabled",
    "inventoryType",
    "inventoryUnit",
    "startingQuantity",
    "quantityPerDose",
    "lowSupplyThreshold",
  ],
  4: ["feedbackType", "dashboardEnabled", "remindersEnabled", "adherenceEnabled"],
};

export const STEP_LABELS = ["Identity", "Schedule", "Inventory", "Feedback"];
