export type SubscriptionStatus = {
  isActive: boolean;
  isExpired: boolean;
  hasSubscription: boolean;
  daysLeft: number;
  expiresAt: Date | null;
  startedAt: Date | null;
  subscriptionDays: number;
};

export function getSubscriptionStatus(
  subscriptionStart: string | null,
  subscriptionDays: number = 30
): SubscriptionStatus {
  if (!subscriptionStart) {
    return {
      isActive: false,
      isExpired: false,
      hasSubscription: false,
      daysLeft: 0,
      expiresAt: null,
      startedAt: null,
      subscriptionDays,
    };
  }

  // Parse subscription_start as a SAST calendar date (YYYY-MM-DD)
  const [sy, sm, sd] = subscriptionStart.split("T")[0].split("-").map(Number);
  const start = new Date(sy, sm - 1, sd); // local midnight
  const expiresAt = new Date(start);
  expiresAt.setDate(expiresAt.getDate() + subscriptionDays);

  // Get today's date in SAST (UTC+2) as a midnight-anchored value
  const sastToday = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const [ty, tm, td] = sastToday.split("-").map(Number);
  const now = new Date(ty, tm - 1, td); // SAST midnight today

  const diffMs = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isActive: daysLeft > 0,
    isExpired: daysLeft <= 0,
    hasSubscription: true,
    daysLeft: Math.max(0, daysLeft),
    expiresAt,
    startedAt: start,
    subscriptionDays,
  };
}
