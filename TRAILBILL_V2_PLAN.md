# TrailBill v2 — Final Build Plan

## Design Principle

**"Grandmother-friendly."** Every screen has one clear action. No jargon. Big buttons. Minimal text. If someone can use WhatsApp, they can use TrailBill.

## UX Requirements

- **Lightweight** — minimal bundle size, no heavy libraries, fast on slow SA networks (3G/LTE)
- **Mobile-first** — every page designed for phone first, then scales up to desktop
- **Skeleton loaders** — every page/component shows skeleton placeholders while data loads (no blank screens, no spinners)
- **Toast notifications everywhere** — every action gives feedback:
  - Client added ✅
  - Payment request sent ✅
  - Payment marked as paid ✅
  - Error saving ❌
  - Lead converted ✅
  - Group created ✅
  - Password changed ✅
  - Template saved ✅
- **No full-page reloads** — use optimistic updates where possible
- **Responsive sidebar** — hamburger menu on mobile, full sidebar on desktop
- **Touch-friendly** — buttons minimum 44px tap targets, generous spacing on mobile

---

## What TrailBill Is

A **payment tracking and cash flow prediction system** for small businesses that bill clients monthly. NOT an invoicing system. You send **payment requests** to groups of clients, they **commit to a payment date** on your terms, and you track who paid, who didn't, and what's coming next. Reminders go out via **Resend (email)** and **WhatsApp**.

---

## Four Sections

1. **Landing Page** — marketing, pricing, sign up
2. **Auth** — login/signup
3. **Admin Dashboard** — platform owner manages the system
4. **Business Dashboard** — business owners manage their payments

---

## Section 1: Landing Page

| Page | What it shows |
|------|--------------|
| `/` | Hero ("Stop chasing payments"), Problem section, Solution steps, Features, Pricing (R299/R599), Footer |

Single page. Clean. One CTA: "Get Started."

---

## Section 2: Auth

| Page | What it shows |
|------|---------------|
| `/login` | Email + password login (for approved businesses only) |
| `/get-started` | Interest form: name, business name (optional), email, phone number. NOT a signup — just a lead capture. |

**No self-signup.** User fills out the form → you (admin) see it in the admin dashboard → you **convert** them: assign a temporary password → system creates their auth account + business record → they receive login credentials via email → on first login they're prompted to **change their password** → then onboarding wizard starts.

This keeps quality control — you decide who gets in.

---

## Section 3: Admin Dashboard (`/admin`)

| Page | What you do |
|------|------------|
| `/admin` | Platform stats: total businesses, total clients, total payment volume, recent activity |
| `/admin/businesses` | List all businesses. Add new. Activate/deactivate subscription (set start date + days). Delete. See each business's client count and payment volume |
| `/admin/leads` | Review interest form submissions. Convert → assign a temporary password → creates auth user + business account → send credentials via email. Reject with reason. |

**Admin controls:**
- Toggle business active/inactive
- Set subscription: start date + number of days
- View any business's details
- **Review interest forms** — see who applied, convert to business (assign temp password), or reject
- **Convert lead** — one click: assign temp password → creates auth user + business → sends credentials

---

## Section 4: Business Dashboard (`/dashboard`)

### First-Time Onboarding Wizard

Triggered on first login (no business profile yet). Three steps in one modal/page:

| Step | What | Fields |
|------|------|--------|
| 1 | **Your Business** | Business name, phone, banking details (bank name, account number, branch code, account type) |
| 2 | **Add Clients** | Paste list (name, phone per line) OR add one by one. Minimum 1 client |
| 3 | **Create First Group** | Group name, select clients, default amount, due day, active months, grace period |

After completing → land on dashboard, ready to go.

---

### Dashboard Pages

#### `/dashboard` — Overview (Home)

**Top:** Big **"Send Payment Request"** button

**Stats row (4 cards):**
- Total Expected This Month
- Total Received
- Total Outstanding (across all clients)
- Overdue

**Cash Flow Calendar (the heart of the product):**
- Past months: payment history (green = paid, red = late, amber = partial)
- Current month: committed dates, due dates, overdue
- Future months: auto-populated from group contracts
- Click any date → see which clients and amounts
- Action feed on the right: Overdue, Due this week, Upcoming, NEEDS ATTENTION flags
- Monthly summary bar: Expected vs Received vs Overdue

**Below calendar:**
- Recent Activity feed
- Client Health scores (top 5 with flags)

---

#### `/dashboard/clients` — Client Management

**Simple table:**

| Client | Phone | Group | Balance | Status |
|--------|-------|-------|---------|--------|
| Springfield Primary | 072... | Primary Schools | R2,500 | ⏳ Awaiting |
| Greenfield Academy | 083... | Primary Schools | -R500 | 💰 Credit |
| Riverside School | 071... | Primary Schools | R7,500 | 🔴 3 months behind |

- **Add Client** button (name + phone + optional email)
- Click a client → **Client Profile** showing:
  - Full payment history (every request, every payment, running balance)
  - Reliability score + trend
  - Flags
  - Custom amount + notes for their group

---

#### `/dashboard/groups` — Group Management

**Group cards showing:**

| Group | Clients | Default Amount | Due Day | Active Months | Grace |
|-------|---------|---------------|---------|---------------|-------|
| Primary Schools | 14 | R2,500 | 4th | 8 of 12 | 5 days |
| Estates | 22 | R1,800 | 1st | 12 of 12 | 3 days |

Click a group → **Group Detail Page:**

**Group Settings (editable):**
1. Group name
2. Default amount
3. Due day of month
4. Contract start month + duration
5. Active months — 12 checkboxes (Jan–Dec)
6. Grace period (days)
7. Late fee % (optional — shown as warning on payment page)
8. **Email template** — text area with variables: `{client_name}`, `{amount}`, `{due_date}`, `{link}`
9. **WhatsApp template** — text area with same variables

**Client list within group:**

| Client | Custom Amount | Custom Note | Balance |
|--------|-------------|-------------|---------|
| Springfield Primary | R2,500 (default) | "3 kids, North route" | R2,500 |
| Greenfield Academy | R3,200 (custom) | "5 kids, South route" | -R500 |

Each client's amount and note is **inline editable**.

---

#### `/dashboard/payments` — Payment Tracker

**Tabs:** All | Awaiting | Committed | Partial | Paid | Overdue

**Simple table:**

| Client | Amount Due | Paid | Balance | Status | Committed Date | Action |
|--------|-----------|------|---------|--------|---------------|--------|
| Springfield | R2,500 | R0 | R2,500 | ⏳ Awaiting | — | Mark Paid |
| Greenfield | R2,700 | R2,700 | R0 | ✅ Paid | May 3 | — |
| Riverside | R5,000 | R1,500 | R3,500 | ⚠️ Partial | May 8 | Mark Paid |

**Mark as Paid modal:**
- Amount received (pre-filled with amount due, editable)
- Payment date
- Method (EFT / Cash / Card)
- Reference number (optional)
- System auto-calculates: overpaid → credit, underpaid → carries forward

---

#### `/dashboard/reports` — Analytics

- Collection rate %
- Avg days to pay
- Slowest payers (top 5)
- Monthly comparison (bar chart)
- Clients flagged as NEEDS ATTENTION
- Export CSV

---

#### `/dashboard/settings` — Business Settings

- Business name, phone
- Banking details (editable)
- Default payment terms
- Logo upload (shows on payment page)
- Account password change

---

### Public Payment Page — `/pay/[token]`

What the **client sees** when they click the link from WhatsApp/email:

```
┌─────────────────────────────────────┐
│                                     │
│     {Business Name} (PTY) Ltd       │
│     Payment request for {Client}    │
│                                     │
│     {Description from template}     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │       Total Amount            │  │
│  │                               │  │
│  │      R 2 500,00               │  │
│  │      Due: 04/05/2026          │  │
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Late fee: 10% = R250    │  │  │
│  │  │ Activates 04 May 2026   │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Ref #TRB-2026-0042          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  🔒 Banking details locked    │  │
│  │     Confirm to unlock          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌──────────┐  ┌────────────────┐  │
│  │  ✅ Pay   │  │ 🕐 Ask for     │  │
│  │   Now     │  │  Extra Days    │  │
│  └──────────┘  └────────────────┘  │
│                                     │
│  Confirm to get banking details,    │
│  or ask for extra days              │
└─────────────────────────────────────┘
```

**"Pay Now" flow:**
1. Click → banking details unlock (bank name, account #, branch, reference to use)
2. Client sees: "Transfer R2,500 to {bank details} using reference TRB-2026-0042"
3. Confirmation: "Once paid, your provider will be notified"
4. We track: link opened, "Pay Now" clicked (activity log)

**"Ask for Extra Days" flow** (only shows if group has grace period):
1. Click → see: "You can request up to {X} extra days"
2. Client picks number of days (e.g., 3)
3. New due date calculated and shown: "New due date: May 7, 2026"
4. Confirm → committed date saved → owner notified → reminders adjusted

**If no action by due date** → reminders fire automatically.

---

## Commitment Flow (How It Works)

1. Payment request sent with **default due date** (e.g., 5 days from now = May 18)
2. Client opens link and sees: **"R2,500 due by May 18"**
3. **If they do nothing** → May 18 stays. Reminders fire based on May 18.
4. **If group has grace period** → client sees "Ask for Extra Days"
5. Client picks extra days (e.g., 3) — cannot exceed the grace limit
6. **New due date = May 21** — calendar updates, reminders adjust
7. Owner sees: "Client X asked for 3 extra days → new due date: May 21"

**Psychology:** Owner set 5 days due + 5 days grace. Client thinks they negotiated 3 extra days. Owner planned for up to 10 days. Everyone wins.

---

## Running Balance System

When owner marks a payment as paid, they enter the **actual amount received**:

| Scenario | What happens |
|----------|-------------|
| Owed R2,500, paid R2,500 | ✅ Exact — balance = R0 |
| Owed R2,500, paid R3,000 | 💰 Overpaid R500 — credit carries to next month (next request shows R2,000) |
| Owed R2,500, paid R1,500 | ⚠️ Underpaid R1,000 — carries forward (next request shows R3,500) |
| Owed R2,500, paid R0 | 🔴 Full amount carries → next month shows R5,000 |

All automatic. Running balance updates the moment payment amount is entered.

---

## Group = Contract

When creating a group, the owner sets:

1. **Group name** — "Primary Schools"
2. **Default amount** — R2,500
3. **Due day** — 4th of each month
4. **Contract start month + duration** — e.g., January 2026, 12 months
5. **Active months** — checkboxes for Jan–Dec (schools skip holidays, estates bill all 12)
6. **Grace period** — e.g., 5 days (0 = no grace)
7. **Late fee %** — optional penalty shown on payment page
8. **Email template** — customizable with `{client_name}`, `{amount}`, `{due_date}`, `{link}`
9. **WhatsApp template** — customizable with same variables

Payment requests **auto-generate** for active months. Calendar **auto-populates** the full contract timeline.

---

## Per-Client Customization Within a Group

Each client inside a group can have:
- **Custom amount** — overrides the group default
- **Custom notes** — shows on their payment request (e.g., "2 children, Parktown route")
- **Editable at any time**

---

## Behavioral Prediction + Flags

Track every client's history:
- How many days late on average
- Partial payment frequency
- Grace days requested — do they always ask for max?
- Trend — getting worse or improving?

| Pattern | Flag |
|---------|------|
| Paid late 3 months in a row, each time later | 🔴 NEEDS ATTENTION |
| Always asks for max grace days + still late | 🔴 NEEDS ATTENTION |
| Was late twice but improving | 🟡 Watch |
| Pays on time or early consistently | 🟢 Reliable |
| First missed payment (new behavior) | 🟡 First miss |

Flags appear on the calendar and dashboard action feed.

---

## Reminders & Follow-ups

- **1 day before committed date:** Reminder via email (Resend) + WhatsApp
- **On committed date:** "Payment due today" notification
- **1 day after missed date:** First follow-up
- **3 days after:** Second follow-up (more urgent)
- **7 days after:** Escalation alert to the business owner
- All reminders are **automatic** based on the committed date

---

## Tech Stack

- **Next.js 16** + TypeScript
- **Supabase** (auth, database, RLS)
- **Tailwind CSS v4** + **shadcn/ui**
- **Lucide React** icons
- **Resend** for email reminders
- **WhatsApp Business API** (when approved — generate shareable links until then)

---

## Database Tables

| Table | Purpose |
|-------|--------|
| `leads` | Interest form submissions (name, business name, email, phone, status: pending/approved/rejected) |
| `profiles` | Auth users (admin or business role) |
| `businesses` | Business accounts with banking details + subscription info |
| `clients` | People/companies that owe money, with reliability scores + running balance |
| `client_groups` | Groups = contracts with amount, due day, duration, active months, grace, late fee, templates |
| `group_memberships` | Links clients to groups with custom amount + notes |
| `payment_batches` | One record per group request (the "batch") |
| `payment_requests` | Individual request per client per batch with public token |
| `payments` | Actual payment records (supports partial, tracks method + reference) |
| `activity_log` | Activity feed for dashboard |
| `behavior_flags` | Client reliability alerts (NEEDS ATTENTION, Watch, Reliable) |
| `reminder_log` | Track sent reminders (email + WhatsApp, with status) |

---

## Build Order

| # | What | Files |
|---|------|-------|
| 1 | Database schema — one clean `001_schema.sql` | 1 SQL file |
| 2 | Lib setup — Supabase client/server, types, utils, middleware | 5 files |
| 3 | Dashboard layout — mobile sidebar with hamburger, header | 3 components |
| 4 | Onboarding wizard — 3-step first-time setup | 1 component |
| 5 | Overview page — stats + calendar + activity + quick action | 2 files |
| 6 | Clients page — table + add modal + client profile | 3 files |
| 7 | Groups page — group cards + create/edit modal + detail page with templates | 4 files |
| 8 | Payments page — tracker table + Mark as Paid modal | 3 files |
| 9 | `/pay/[token]` — client payment page | 1 file |
| 10 | Admin layout + overview | 3 files |
| 11 | Admin businesses page — list + add + subscription controls | 3 files |
| 12 | Reports page | 1 file |
| 13 | Settings page | 1 file |
| 14 | Landing page — hero, problem, solution, features, pricing, footer | 7 components |
| 15 | Auth pages — login + interest form (get-started) | 2 files |
| 16 | Reminder system — Resend email integration | Later |
| 17 | WhatsApp integration | When API approved |

**~35-40 files total.** Clean, no dead code, no unused components.

---

## Brand

- **Primary color:** #0DA2E7 (sky-500)
- **Secondary:** Charcoal black
- **Design:** Bold, modern, mobile-first
- **Pricing:** R299/month (Starter), R599/month (Pro)
- **Currency:** ZAR throughout
