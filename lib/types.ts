export type Lead = {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'business';
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: string;
  owner_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  sms_number: string | null;
  email_notifications: boolean;
  whatsapp_notifications: boolean;
  sms_notifications: boolean;
  bank_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: 'cheque' | 'savings' | 'transmission' | 'business' | 'credit' | 'other' | string | null;
  industry: string | null;
  default_due_days: number;
  default_grace_days: number;
  default_late_fee_pct: number;
  subscription_start: string | null;
  subscription_days: number;
  status: 'active' | 'inactive';
  onboarding_completed: boolean;
  logo_url: string | null;
  province: string | null;
  city: string | null;
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  weekly_report_enabled: boolean;
  weekly_report_day: string;
  weekly_report_time: string;
  end_of_week_report_enabled: boolean;
  end_of_week_report_day: string;
  end_of_week_report_time: string;
  month_start_report_enabled: boolean;
  month_start_report_time: string;
  month_end_report_enabled: boolean;
  month_end_report_time: string;
  reminder_send_time: string;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sms_number: string | null;
  client_type: 'individual' | 'business';
  province: string | null;
  city: string | null;
  preferred_channel: 'email' | 'whatsapp' | 'both';
  inferred_payday_day: number | null;
  payday_confidence: 'none' | 'low' | 'medium' | 'high';
  reliability_score: number;
  average_days_to_pay: number;
  on_time_rate: number;
  total_paid: number;
  total_requests: number;
  status: 'excellent' | 'good' | 'warning' | 'at-risk';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientGroup = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  default_amount: number;
  due_day: number;
  contract_start_month: string | null;
  contract_duration_months: number;
  active_months: number[];
  grace_days: number;
  late_fee_pct: number;
  email_template: string | null;
  whatsapp_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GroupMembership = {
  id: string;
  group_id: string;
  client_id: string;
  custom_amount: number | null;
  custom_note: string | null;
  is_active: boolean;
  created_at: string;
};

export type PaymentBatch = {
  id: string;
  business_id: string;
  group_id: string;
  batch_number: string;
  description: string | null;
  month: string;
  total_amount: number;
  total_clients: number;
  scheduled_at: string | null;
  status: 'scheduled' | 'sent' | 'partial' | 'completed';
  created_at: string;
};

export type PaymentRequest = {
  id: string;
  batch_id: string;
  business_id: string;
  client_id: string;
  request_number: string;
  public_token: string;
  base_amount: number;
  previous_balance: number;
  total_due: number;
  amount_paid: number;
  outstanding: number;
  description: string | null;
  custom_note: string | null;
  due_date: string;
  grace_end_date: string | null;
  committed_date: string | null;
  extra_days_requested: number;
  late_fee_pct: number;
  link_opened_at: string | null;
  pay_now_clicked_at: string | null;
  committed_at: string | null;
  status: 'scheduled' | 'sent' | 'opened' | 'committed' | 'partial' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  request_id: string;
  business_id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  method: 'eft' | 'cash' | 'card' | 'other' | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  business_id: string | null;
  type: 'payment' | 'request' | 'reminder' | 'overdue' | 'client' | 'group' | 'system' | 'late_fee';
  description: string;
  amount: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BehaviorFlag = {
  id: string;
  business_id: string;
  client_id: string;
  flag_type: 'needs_attention' | 'watch' | 'reliable' | 'first_miss' | 'improving';
  message: string;
  severity: 'critical' | 'warning' | 'info';
  is_read: boolean;
  created_at: string;
};

export type ReminderLog = {
  id: string;
  request_id: string;
  client_id: string;
  business_id: string | null;
  channel: 'email' | 'whatsapp';
  reminder_type: '1_day_before' | 'due_date' | '1_day_after' | '3_days_after' | '7_days_after';
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  sent_at: string | null;
  created_at: string;
};

export type PaymentEvent = {
  id: string;
  business_id: string;
  request_id: string;
  client_id: string;
  event_type:
    | 'reminder_sent'
    | 'email_opened'
    | 'whatsapp_delivered'
    | 'whatsapp_read'
    | 'link_visited'
    | 'pay_now_clicked'
    | 'extra_days_requested'
    | 'payment_recorded';
  channel: 'email' | 'whatsapp' | 'system' | null;
  reminder_type: '1_day_before' | 'due_date' | '1_day_after' | '3_days_after' | '7_days_after' | null;
  days_relative_to_due: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Joined types for UI
export type PaymentRequestWithClient = PaymentRequest & {
  clients: { name: string; phone: string | null } | null;
};

export type GroupMembershipWithClient = GroupMembership & {
  clients: Client;
};

export type ClientGroupWithCount = ClientGroup & {
  client_count: number;
};
