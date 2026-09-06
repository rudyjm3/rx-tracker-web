# RxTracker Live vs Rebuild Audit Findings
**Date:** September 6, 2026  
**Audited by:** AI Assistant  
**Live site:** https://rx-tracker.dwdrm.com  
**Rebuild (local):** http://localhost:3000

---

## Executive Summary

Complete audit of live RxTracker (PHP/MySQL) vs rebuild (Next.js/Supabase) covering all major user flows. The rebuild has good feature parity for core medication management, tracking, and reporting. **Major gaps** exist in advanced features like Export/Doctor Visit Report, Dashboard inline actions, and Settings configuration options.

---

## ✅ COMPLETED FEATURES (Parity or Better)

### Medications Page
- ✅ **Active / Inactive / Groups tabs** — Both have identical tab structure
- ✅ **Medication cards** — Rebuild matches or exceeds live design quality
- ✅ **Medication details modal** — Rebuild has drug info with chemical structure (better than live)
- ✅ **Add Medication wizard** — Rebuild has 4-step wizard matching live flow
- ✅ **Medication type badges** (Rx/OTC/Vitamin-Supplement) — Both present
- ✅ **Inventory tracking** — Progress bars, days left, refill alerts on both
- ✅ **Medication filter** — ✨ **JUST IMPLEMENTED** in rebuild (feature/medication-filter-drag-reorder branch)
- ✅ **Drag-to-reorder medications** — ✨ **JUST IMPLEMENTED** in rebuild (feature/medication-filter-drag-reorder branch)

### Dashboard
- ✅ **Next Dose hero card** — Both show upcoming dose
- ✅ **Today's Adherence ring** — Both visualize completion percentage
- ✅ **Today's Schedule** — Both list scheduled doses
- ✅ **Quick Actions** — Both have shortcuts

### Calendar
- ✅ **Month view calendar** — Both have grid with day summaries (T/S/M indicators)
- ⚠️ **Legend** — Live has Taken/Skipped/Missed color legend; rebuild missing (minor gap)

### Pain Tracking
- ✅ **Pain level logging** — Both support tracking
- ✅ **Medication association** — Both link pain to meds
- ✅ **Pain graph/visualization** — Rebuild arguably better with individual "View pain graph" per med

### Mood & Wellbeing
- ✅ **Mood logging** — Both support tracking
- ✅ **Medication association** — Both link mood to meds
- ✅ **Mood trend visualization** — Both have graphs

### Profile / My Account
- ✅ **Profile information** — Name, email, etc. on both
- ✅ **Allergies & Intolerances** — Both have allergy management
- ✅ **Password change** — Both support
- ✅ **Active sessions** — Both show logged-in devices
- ✅ **Data & Privacy** — Both have privacy controls
- ✅ **Delete Account** — Both have account deletion flow
- ⚠️ **Profile photo upload** — Live has; rebuild missing (minor gap)

### Family Management
- ✅ **Family profiles under one account** — Both support family member switching
- ✅ **No separate logins needed** — Architecture matches
- ⚠️ **Profile switching banner** — Live shows amber "Viewing [name]'s medications — Switch back to Me" banner; rebuild should have equivalent (not fully tested due to separate DBs)

---

## 🔴 MAJOR GAPS (Live has, Rebuild missing or incomplete)

### 1. Export Page / Doctor Visit Report
**Live:**
- Full "Doctor Visit Report" PDF generator
- Date range selector (reporting period)
- Include Pain Tracking toggle
- Include Mood & Wellbeing toggle
- Per-medication selector (choose which meds to include)
- Branded PDF download with RxTracker logo and professional layout

**Rebuild:**
- Raw table summary + browser print/PDF
- No date range selector
- No Pain/Mood inclusion toggles
- No per-med selection
- No branded PDF generation

**Priority:** HIGH — This is a key differentiation feature for medical visits

---

### 2. Dashboard Today's Schedule — Inline Actions ✅ RESOLVED
**Status (2026-09-06):** Confirmed already implemented and working — `components/dashboard/DoseRow.tsx` renders inline **Take / Skip / Snooze** buttons for any pending slot (verified live in browser: buttons render, no console errors). This finding in the original audit was stale/incorrect. No further work needed.

---

### 3. Settings — Timezone & Schedule Configuration ✅ RESOLVED
**Status (2026-09-06):** Grace period and default snooze duration were already fully implemented (`GeneralSettingsPanel` in `components/settings/SettingsClient.tsx`, backed by `lib/app-settings.ts`) — the original audit missed them. Added the missing **timezone selector** + **"Use device timezone"** toggle on `feature/export-report-and-dashboard-actions`, stored via `app_settings` the same way. Verified live: toggle/select render, save persists across reload, zero console errors. (Stored as a preference, not wired into date math — the rebuild is client-rendered and already correctly follows the browser's local time; see commit for rationale.)

---

### 4. Edit Medication — Full Form ✅ RESOLVED
**Status (2026-09-06):** Verified — edit reuses the same 4-step wizard as Add Medication (`app/medications/[id]/edit/page.tsx` → `WizardShell mode="edit"`), and has every live-site field: name, medication type, start date, dose amount/unit/form, schedule type + dose times + "+ Add time", PRN toggle, track-dose-feedback dropdown, inventory section (starting quantity, dose-reduces-inventory-by, low-supply-threshold), instructions, medication group dropdown, and a "Save changes" button on submit. Also has several fields beyond the live site (DailyMed autocomplete, end date, per-time quantity override, interval scheduling, dashboard/reminder/adherence toggles). The one nuance: "Notes" is not a field inside this form — it's a separate always-available feature (see #6 below), matching the live site's actual behavior (Instructions lives on the medication record; Notes are separate timestamped entries).

---

### 5. Three-Dot Menu Actions ✅ RESOLVED
**Status (2026-09-06):** Verified live in browser — every menu item on `MedicationCard.tsx` opens its modal correctly with zero console errors: Edit, Log Dose, Log Refill, Update prescribed dose, Refill History, Adjust Quantity, Notes/Instructions, Side Effects, Discontinue Use. The original audit's uncertainty was due to browser/modal timing during that session, not missing functionality.

---

### 6. Notes / Instructions ✅ RESOLVED
**Status (2026-09-06):** Already implemented — `components/medications/NotesModal.tsx`, backed by the `medication_notes` table (`lib/notes.ts`), wired into `MedicationCard.tsx`'s "Notes/Instructions" menu item. Verified it opens live with no errors.

---

### 7. Side Effect Logging ✅ RESOLVED
**Status (2026-09-06):** Already implemented — "Side Effects" menu item on `MedicationCard.tsx` opens its modal correctly (verified live, no errors). The original audit's "modal did not open" note was a testing artifact, not a real gap.

---

### 8. Notifications
**Live:**
- Bell icon in header (may require active reminders to show notifications)
- Full web push notification infrastructure:
  - VAPID keys
  - Service worker registration
  - Cron for scheduled reminders
  - Test push button in Settings
  - Notification status display

**Rebuild:**
- Settings mention push notifications are delivered via **Android app** (architectural difference)
- No web push infrastructure observed

**Priority:** LOW — This is an **architectural choice** (web push vs native app push), not a missing feature per se

---

## 🟡 MINOR GAPS

### Calendar Legend
- Live has Taken/Skipped/Missed color legend and disclaimer footer
- Rebuild calendar lacks legend

### Profile Photo
- Live has photo upload and display
- Rebuild profile shows "—" for display name (likely test data)
- No photo upload visible in rebuild

---

## 🟢 NON-GAPS (Initially suspected, confirmed present)

- ✅ Medication Groups form — User explicitly likes rebuild version as-is
- ✅ Medication Groups tab — Present in both
- ✅ Drug details modal — Rebuild arguably better (has chemical structure)
- ✅ Add Medication wizard — Rebuild has near-identical flow
- ✅ Pain Tracking — Good parity
- ✅ Mood & Wellbeing — Good parity
- ✅ Profile core features — Password, sessions, privacy, delete account all present

---

## 🎯 RECOMMENDED PRIORITIES

### P0 (Critical for launch parity)
1. ✅ **Export / Doctor Visit Report** — Full PDF generator with date range, Pain/Mood toggles, med selector — DONE on `feature/export-report-and-dashboard-actions`
2. ✅ **Dashboard inline actions** — Take/Skip/Snooze on Today's Schedule rows — already implemented, confirmed 2026-09-06

### P1 (Important for feature parity)
3. ✅ **Settings timezone/grace/snooze** — DONE on `feature/export-report-and-dashboard-actions` (grace/snooze already existed; timezone added)
4. ✅ **Edit Medication flow** — Verified complete, matches/exceeds live, confirmed 2026-09-06

### P2 (Nice to have)
5. ✅ **Three-dot menu actions** — All verified working live, confirmed 2026-09-06
6. ✅ **Notes feature** — Already implemented, confirmed 2026-09-06
7. **Calendar legend** — Color key for Taken/Skipped/Missed — still open
8. **Profile photo upload** — Upload and display user photo — still open

### P3 (Low priority)
9. ✅ **Side effect logging** — Already implemented, confirmed 2026-09-06

---

## 📝 NOTES

- **Live site uses MySQL; rebuild uses separate Supabase** — Data does not sync
- **Test accounts:**
  - Live: rudyjm3@gmail.com (Rudolph Mims primary, Connie Zimmerman family member)
  - Rebuild: rudyjm3@yahoo.com (Rudolph Mims primary, no Connie in rebuild DB)
  - Avoided "Jonathan" child profile per user instruction
- **Family switching confirmed on live** — Amber banner "Viewing Connie Zimmerman's medications — Switch back to Me"
- **Rebuild Medication Group form** — User stated: "Just so you know, how the medication group form is on the rebuild I like how this is" — DO NOT CHANGE
- **Medication Plan filter + drag-reorder** — Implemented on `feature/medication-filter-drag-reorder` branch (just completed)

---

## 🔍 REMAINING AUDIT ITEMS (Not fully tested)

Items 1-6 below were resolved and verified live on 2026-09-06 (see sections 2-7 above) — the original "not fully audited" status was a testing artifact (browser/modal timing during that session), not a real gap. Still genuinely open:

7. **Notifications bell icon** — Clicked but no notifications present (may require active reminders)
8. **Dose history / Log page** — No dedicated history page found in main nav; may be accessed via calendar or other entry point
9. **Onboarding / first-time user flow** — Not tested (existing account used) — note a `feature/onboarding-wizard` branch already exists, check its status before assuming this is unbuilt
10. **Connie Zimmerman full page-by-page audit on live** — Only confirmed profile switch banner; did not go through every page as Connie

---

**End of Audit Report**
