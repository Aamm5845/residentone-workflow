# Timeline Hours & Invoice Billing Integration

## Overview

This feature links the timeline system (time entries tracked by team members) with the invoice billing system, ensuring every billable hour is accounted for as either **billed** or **unbilled**. It supports both automatic linking from time entries AND manual hour entry on invoices.

---

## Schema Changes

### New Enum: `BilledStatus`
```
UNBILLED (default)
BILLED
```

### TimeEntry — New Fields
| Field | Type | Description |
|-------|------|-------------|
| `billedStatus` | `BilledStatus` | Defaults to `UNBILLED`. Set to `BILLED` when linked to an invoice line item. |
| `billedInvoiceLineItemId` | `String?` | FK to `BillingInvoiceLineItem`. Set when billed, cleared (`SetNull`) if line item is deleted. |
| `billedAt` | `DateTime?` | Timestamp of when the entry was marked as billed. |

### New Index
- `@@index([projectId, billedStatus])` — Enables efficient unbilled queries per project.

### BillingInvoiceLineItem — New Relation
- `linkedTimeEntries TimeEntry[]` — Reverse relation to see which time entries are linked to a line item.

---

## API Endpoints

### GET `/api/billing/unbilled-hours`

Fetches all unbilled, billable, stopped time entries for a project.

**Query Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `projectId` | Yes | Project to query |
| `userId` | No | Filter by specific user |
| `startDate` | No | Filter entries from this date |
| `endDate` | No | Filter entries until this date |

**Response:**
```json
{
  "summary": {
    "totalUnbilledMinutes": 510,
    "totalUnbilledHours": 8.5,
    "entryCount": 12,
    "hourlyRate": 200,
    "estimatedAmount": 1700
  },
  "entries": [
    {
      "id": "...",
      "userId": "...",
      "userName": "John Doe",
      "description": "Design concept work",
      "startTime": "2026-02-07T09:00:00.000Z",
      "endTime": "2026-02-07T12:30:00.000Z",
      "duration": 210,
      "durationHours": 3.5,
      "room": { "id": "...", "name": "Living Room", "type": "LIVING_ROOM" },
      "stage": { "id": "...", "type": "DESIGN_CONCEPT" }
    }
  ]
}
```

The `hourlyRate` is automatically pulled from the most recent signed proposal for the project.

---

## Invoice CRUD — Billing Status Management

### On Invoice Create (POST `/api/billing/invoices`)
- For each HOURLY line item with `timeEntryIds[]`, marks those TimeEntry records as:
  - `billedStatus = BILLED`
  - `billedInvoiceLineItemId = <line item id>`
  - `billedAt = now()`

### On Invoice Update (PUT `/api/billing/invoices/[id]`)
- **Before** deleting old line items: resets linked entries to `UNBILLED`
- **After** creating new line items: marks new linked entries as `BILLED`
- **On VOID/CANCELLED status**: unbills all linked entries

### On Invoice Delete (DELETE `/api/billing/invoices/[id]`)
- Unbills all linked time entries before deleting the invoice

### Validation
- Only entries with `billedStatus = UNBILLED` can be marked as billed (prevents double-billing)

---

## Timeline API Enhancements

### GET `/api/timeline/entries`
- **New query param**: `billedStatus` (`BILLED` | `UNBILLED`) — filter entries by billing status
- **Response**: includes `billedStatus` field on each entry

### GET `/api/timeline/reports`
- **Summary** now includes:
  - `billedHours` — total hours already billed
  - `unbilledHours` — total hours not yet billed

### GET `/api/reports/[projectId]/time-investment`
- **Summary** now includes:
  ```json
  "billing": {
    "billedHours": 24.5,
    "unbilledHours": 8.5
  }
  ```

---

## UI Components

### TimeEntrySelector (`src/components/billing/invoices/TimeEntrySelector.tsx`)

A modal dialog for selecting unbilled time entries when creating HOURLY invoice line items.

**Features:**
- Fetches from `/api/billing/unbilled-hours`
- Entries grouped by day with checkboxes
- Date range presets: All Time, This Week, Last Week, This Month, Last Month
- User dropdown filter (when multiple users have entries)
- Running total of selected hours and estimated amount
- Select All / Deselect All toggle
- `excludeEntryIds` prop prevents selecting entries already linked to other line items on the same invoice

### InvoiceForm Integration (`src/components/billing/invoices/InvoiceForm.tsx`)

- **"Add Hours from Timeline"** button in the line items toolbar
- Clicking it adds an HOURLY line item and opens the TimeEntrySelector
- On selection: auto-populates hours, timeEntryIds, and calculates amount
- Shows badge on linked items: `"12 entries (8.5 hrs)"`
- Hours field remains manually editable
- Manual HOURLY line items (without linked entries) still work as before
- `timeEntryIds` passed through to the save API call

### Unbilled Hours Dashboard Card (`src/app/projects/[id]/billing/BillingPageClient.tsx`)

- Blue card at the top of the billing page when unbilled hours exist
- Shows: total unbilled hours, entry count, estimated amount
- **"Invoice Now"** button navigates to new invoice creation

### Billed Status Badges (`src/components/timeline/MyTimesheet.tsx`)

- Each billable stopped time entry shows:
  - Green **"Billed"** badge — entry is linked to an invoice
  - Amber **"Unbilled"** badge — entry is not yet billed

### Time Reports Breakdown (`src/components/timeline/TimeReports.tsx`)

- Two new summary cards:
  - **Billed Hours** (emerald) — hours already invoiced
  - **Unbilled Hours** (amber) — hours awaiting invoicing

---

## How It Works — User Flow

### Billing Unbilled Hours
1. Team members track hours via timer or manual entry on a project
2. On the project billing page, an **unbilled hours card** shows how many hours need invoicing
3. User clicks **"Invoice Now"** or creates a new invoice
4. In the invoice form, clicks **"Add Hours from Timeline"**
5. The TimeEntrySelector modal opens showing all unbilled entries
6. User filters by date range / team member, selects entries, confirms
7. Hours auto-populate on the line item with the correct amount
8. User saves the invoice — entries are marked as `BILLED`

### Editing / Deleting Invoices
- **Edit**: old linked entries are unlinked (set to UNBILLED), new selections are billed
- **Delete**: all linked entries revert to UNBILLED
- **Void/Cancel**: all linked entries revert to UNBILLED

### Mixed Invoices
- An invoice can have both linked HOURLY items (from timeline) and manual HOURLY items
- An invoice can mix FIXED, HOURLY, MILESTONE, and DEPOSIT line items

---

## Files Created
| File | Purpose |
|------|---------|
| `src/app/api/billing/unbilled-hours/route.ts` | Unbilled hours API endpoint |
| `src/components/billing/invoices/TimeEntrySelector.tsx` | Time entry selection modal |

## Files Modified
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | BilledStatus enum, new fields on TimeEntry, reverse relation on LineItem |
| `src/app/api/billing/invoices/route.ts` | Mark entries billed on invoice create |
| `src/app/api/billing/invoices/[id]/route.ts` | Unbill/rebill on update, delete, void |
| `src/app/api/timeline/entries/route.ts` | billedStatus in response + query filter |
| `src/app/api/timeline/reports/route.ts` | Billed/unbilled hours in summary |
| `src/app/api/reports/[projectId]/time-investment/route.ts` | Billing breakdown in summary |
| `src/components/billing/invoices/InvoiceForm.tsx` | TimeEntrySelector integration |
| `src/app/projects/[id]/billing/BillingPageClient.tsx` | Unbilled hours dashboard card |
| `src/components/timeline/MyTimesheet.tsx` | Billed/Unbilled badges |
| `src/components/timeline/TimeReports.tsx` | Billed/unbilled summary cards |

---

## Key Design Decisions

1. **Billed status lives on TimeEntry** — enables efficient `WHERE billedStatus = 'UNBILLED'` queries without scanning all invoice line items
2. **`onDelete: SetNull`** on the FK — if a line item is deleted by cascade, the entry's FK is nulled; app code also resets status to UNBILLED
3. **Manual hours always supported** — HOURLY line items work with or without linked time entries
4. **Only STOPPED entries** can be billed — running/paused entries are excluded from the selector
5. **Double-billing prevention** — TimeEntrySelector excludes already-selected entries via `excludeEntryIds`; API validates `billedStatus = UNBILLED` before marking
