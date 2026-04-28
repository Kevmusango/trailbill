-- Auto-expire subscriptions where subscription_end has passed
-- Called from the dashboard layout on every page load (no pg_cron needed)

create or replace function expire_subscriptions()
returns void
language sql
security definer
as $$
  update businesses
  set subscription_active = false
  where subscription_active = true
    and subscription_end is not null
    and subscription_end <= current_date;
$$;
