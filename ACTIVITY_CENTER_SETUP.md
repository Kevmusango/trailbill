# Activity Center Setup Guide

## Overview
The Activity Center is TrailBill's daily engagement system that keeps business owners actively using the platform by showing reminders, scheduled sends, and upcoming activity - all in **South African Time (SAST / UTC+2)**.

---

## 🗄️ Database Setup

### 1. Run Migration
Execute the SQL migration in Supabase SQL Editor:

```bash
# File: supabase/003_reminder_tracking.sql
```

This creates:
- **`reminder_log`** table - Tracks sent reminders to prevent duplicates
- **Weekly report settings** columns in `businesses` table
- **Database functions** for SAST timezone calculations:
  - `get_todays_reminders(business_uuid)` - Returns today's reminders
  - `get_upcoming_week_activity(business_uuid)` - Returns next 7 days activity

### 2. Default Settings
When migration runs, businesses get these defaults:
- **Daily Digest**: Enabled, 08:00 SAST
- **Weekly Report**: Enabled, Monday 08:00 SAST
- **End of Week Report**: Enabled, Friday 17:00 SAST

---

## 📍 Features Implemented

### 1. **Dashboard Card** (`@/components/dashboard/todays-activity-card.tsx`)
**Location**: Main dashboard, above stat cards

**Shows**:
- Today's reminder count
- Scheduled sends count
- Pending reminders count
- Next action (e.g., "12 reminders sending soon")

**Behavior**: Clickable card that navigates to `/dashboard/activity`

---

### 2. **Activity Center Page** (`/dashboard/activity`)
**Route**: `/dashboard/activity`

**Sections**:

#### a) Today's Summary Cards
- Total Reminders Today
- Scheduled Sends
- Pending to Send

#### b) Today's Reminders (Grouped by Type)
- **1 Day Before Due** (blue)
- **Due Today** (amber)
- **1 Day Overdue** (orange)
- **3 Days Overdue** (red)
- **7 Days Overdue** (dark red)

Each shows:
- Client name
- Amount
- Status (sent ✓ or pending ⏰)

#### c) Scheduled Sends Today
Lists payment batches scheduled to go out today with:
- Description
- Client count
- Total amount
- Send time (SAST)

#### d) Email Reports Schedule
Shows configured weekly reports:
- Daily Digest (every day)
- Weekly Report (default: Monday)
- End of Week Report (default: Friday)

#### e) Upcoming This Week Timeline
7-day view showing:
- Scheduled payment sends
- 1 day before reminders
- Due date reminders

---

### 3. **Sidebar Navigation**
Added **"Activity"** link between Overview and Clients with Bell icon.

---

## 🔔 Reminder System

### Automatic Reminder Schedule
Based on `due_date` and `grace_end_date`:

1. **1 day before due** - Friendly heads-up
2. **Due date** - Payment is due today
3. **1 day overdue** - First follow-up
4. **3 days overdue** - Second follow-up
5. **7 days overdue** - Final follow-up

### Duplicate Prevention
- `reminder_log` table tracks sent reminders
- Unique constraint: `(payment_request_id, reminder_type, channel)`
- System checks before sending to avoid duplicates

### Channel Respect
Reminders respect the `notification_channels` setting:
- `email` - Email only
- `whatsapp` - WhatsApp only
- `both` - Both channels

---

## 📧 Email Reports (To Be Implemented)

### Daily Digest (08:00 SAST)
**Content**:
- Today's reminders count
- Scheduled sends
- Overdue summary
- Quick action links

### Weekly Report (Monday 08:00 SAST)
**Content**:
- New payment requests sent
- Total payments received
- Outstanding balance
- Overdue clients
- Week-over-week comparison

### End of Week Report (Friday 17:00 SAST)
**Content**:
- Week summary
- Weekend prep (upcoming due dates)
- Client reliability updates
- Action items for next week

---

## 🕐 South African Time (SAST)

All times are in **Africa/Johannesburg** timezone (UTC+2):
- Database functions use `AT TIME ZONE 'Africa/Johannesburg'`
- Frontend displays use `toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })`
- API endpoints calculate dates in SAST

---

## 🔌 API Endpoints

### GET `/api/activity/today`
Returns today's activity summary.

**Response**:
```json
{
  "success": true,
  "today": "2026-04-14",
  "summary": {
    "totalReminders": 12,
    "pendingReminders": 8,
    "scheduledSends": 3
  },
  "reminders": {
    "one_day_before": [...],
    "due_today": [...],
    "one_day_overdue": [...],
    "three_days_overdue": [...],
    "seven_days_overdue": [...]
  },
  "scheduledSends": [...],
  "weeklyReports": {
    "weekly": { "type": "weekly_report", "day": "monday", "time": "08:00:00", "nextSend": "..." },
    "endOfWeek": { "type": "end_of_week_report", "day": "friday", "time": "17:00:00", "nextSend": "..." },
    "dailyDigest": { "type": "daily_digest", "time": "08:00:00" }
  }
}
```

### GET `/api/activity/week`
Returns upcoming week's activity.

**Response**:
```json
{
  "success": true,
  "weekActivity": [
    {
      "date": "2026-04-15",
      "activities": [
        { "type": "scheduled_send", "count": 5, "totalAmount": 12500 },
        { "type": "reminder_1_day_before", "count": 8, "totalAmount": 24000 }
      ]
    }
  ]
}
```

---

## 🎯 Daily Engagement Strategy

### Goal: Daily Login Habit

**Morning (08:00 SAST)**:
1. Daily Digest email arrives
2. Business owner logs in
3. Sees Today's Activity card on dashboard
4. Reviews pending reminders
5. Checks scheduled sends

**Throughout Day**:
- Reminders auto-send at configured times
- Activity Center shows real-time status
- Owner can preview/cancel scheduled items

**End of Week (Friday 17:00 SAST)**:
- End of Week Report email
- Weekend prep checklist
- Next week preview

---

## 🚀 Next Steps (Email Implementation)

To complete the email reports, you'll need to:

1. **Create Email Templates** (using React Email or similar)
   - Daily Digest template
   - Weekly Report template
   - End of Week Report template

2. **Set Up Cron Jobs** (using Vercel Cron or similar)
   - Daily: 08:00 SAST
   - Weekly: Monday 08:00 SAST
   - End of Week: Friday 17:00 SAST

3. **Resend Integration**
   - API Key: Already configured
   - From: noreply@trailbill.co.za
   - Templates: HTML emails with TrailBill branding

4. **Create API Routes**
   - `/api/cron/daily-digest`
   - `/api/cron/weekly-report`
   - `/api/cron/end-of-week-report`

---

## 📝 Settings Management

Business owners can configure reports in `/dashboard/settings`:
- Enable/disable each report type
- Change send day (weekly/end-of-week)
- Change send time
- All times in SAST

---

## ✅ Testing Checklist

- [ ] Run database migration in Supabase
- [ ] Verify Today's Activity card appears on dashboard
- [ ] Navigate to `/dashboard/activity` and verify all sections load
- [ ] Check that times display in SAST
- [ ] Verify sidebar "Activity" link works
- [ ] Test with different reminder scenarios
- [ ] Confirm duplicate prevention works

---

## 🔧 Troubleshooting

**Issue**: TypeScript error "Cannot find module '@/components/dashboard/activity-timeline'"
**Solution**: Restart TypeScript server or reload VS Code window. File exists but TS cache needs refresh.

**Issue**: Times showing in wrong timezone
**Solution**: Verify `timeZone: "Africa/Johannesburg"` is used in all date formatting.

**Issue**: Reminders not showing
**Solution**: Check that payment requests have `status IN ('sent', 'scheduled', 'partial')` and `outstanding > 0`.

---

## 📊 Database Schema Changes

### New Table: `reminder_log`
```sql
- id (uuid, PK)
- business_id (uuid, FK → businesses)
- payment_request_id (uuid, FK → payment_requests)
- reminder_type (text: 1_day_before, due_date, 1_day_after, 3_days_after, 7_days_after)
- sent_at (timestamptz)
- channel (text: email, whatsapp)
- status (text: sent, failed, bounced)
- created_at (timestamptz)
```

### Updated Table: `businesses`
```sql
+ weekly_report_enabled (boolean, default: true)
+ weekly_report_day (text, default: 'monday')
+ weekly_report_time (time, default: '08:00:00')
+ end_of_week_report_enabled (boolean, default: true)
+ end_of_week_report_day (text, default: 'friday')
+ end_of_week_report_time (time, default: '17:00:00')
+ daily_digest_enabled (boolean, default: true)
+ daily_digest_time (time, default: '08:00:00')
```

---

**Built with ❤️ for South African businesses**
