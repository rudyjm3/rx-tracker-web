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

### 3. Settings — Timezone & Schedule Configuration
**Live:**
- **Time zone selector** dropdown
- **"Use device timezone"** toggle
- **Missed-dose grace period** setting (minutes)
- **Default snooze duration** setting (minutes)

**Rebuild:**
- Alarm/vibration/test alarm settings present
- Missing timezone selector
- Missing grace period setting
- Missing default snooze duration

**Priority:** MEDIUM — Important for users traveling or wanting custom tolerances

---

### 4. Edit Medication — Full Form
**Live:**
- Modal with all fields:
  - Name, Medication type, Start date
  - Dose amount/unit/form
  - Schedule type (Fixed times / As needed)
  - Dose times (with "+ Add time")
  - As needed (PRN) toggle
  - Track dose feedback dropdown
  - **▼ Inventory tracking** (collapsible):
    - Starting quantity
    - Dose reduces inventory by
    - Low supply alert at
  - **Instructions and Notes** (text area)
  - **Medication group** (optional dropdown)
  - **Save changes** button

**Rebuild:**
- ⚠️ **Edit flow not audited** — Need to verify if rebuild has full edit modal matching live
- Known: Add Medication wizard is present; Edit should mirror

**Priority:** MEDIUM — Verify and document edit flow in rebuild

---

### 5. Three-Dot Menu Actions
**Live medication card menu:**
- ✅ Edit
- ✅ Log past dose
- ❓ Log refill (modal exists but not fully tested)
- ❓ Update prescribed dose (menu item present)
- ✅ Refill history (working — shows monthly refill log with +/- pills and quantity after)
- ❓ Adjust quantity (menu item present)
- ❓ Discontinue Use (menu item present)

**Rebuild:**
- ⚠️ **Three-dot menu not audited** — Need to verify which actions exist
- Known: Cards have chevron expand and some action buttons visible

**Priority:** MEDIUM — Document which quick actions are missing

---

### 6. Notes / Instructions
**Live:**
- "View instructions / Notes" link on medication cards
- Opens modal showing:
  - **Instructions (from medication record):** [text]
  - **+ Add new note** link
- Simple, effective notes feature

**Rebuild:**
- ⚠️ **Notes feature not audited** — Need to check if notes exist

**Priority:** MEDIUM

---

### 7. Side Effect Logging
**Live:**
- "Log side effect" button on medication cards
- (Modal did not open during test — may be timing issue or requires specific setup)

**Rebuild:**
- ⚠️ **Side effect logging not audited** — Need to verify

**Priority:** MEDIUM

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
3. **Settings timezone/grace/snooze** — Time zone selector, grace period, default snooze
4. **Edit Medication flow** — Verify full edit modal exists and matches live

### P2 (Nice to have)
5. **Three-dot menu actions** — Log refill, Update prescribed dose, Adjust quantity, Discontinue
6. **Notes feature** — Instructions and notes modal
7. **Calendar legend** — Color key for Taken/Skipped/Missed
8. **Profile photo upload** — Upload and display user photo

### P3 (Low priority)
9. **Side effect logging** — If not already present

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

Due to browser/modal timing issues and architectural differences, the following were **not fully audited**:

1. **Edit Medication flow in rebuild** — Need full walkthrough
2. **Log refill modal fields** — Modal exists in DOM but didn't visibly open
3. **Update prescribed dose** — Menu item exists but not tested
4. **Adjust quantity** — Menu item exists but not tested
5. **Discontinue Use / Resume Use** — Menu items exist but not tested
6. **Log side effect modal** — Button exists but modal didn't open during test
7. **Notifications bell icon** — Clicked but no notifications present (may require active reminders)
8. **Dose history / Log page** — No dedicated history page found in main nav; may be accessed via calendar or other entry point
9. **Onboarding / first-time user flow** — Not tested (existing account used)
10. **Connie Zimmerman full page-by-page audit on live** — Only confirmed profile switch banner; did not go through every page as Connie

---

**End of Audit Report**
