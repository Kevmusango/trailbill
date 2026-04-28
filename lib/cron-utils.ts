/** Returns the current 30-min slot start/end in SAST (UTC+2) */
export function getSastTimeWindow(): { slotStart: string; slotEnd: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now      = new Date();
  const sastHour = (now.getUTCHours() + 2) % 24;
  const slotMin  = now.getUTCMinutes() < 30 ? 0 : 30;

  const slotStart = `${pad(sastHour)}:${pad(slotMin)}:00`;
  const endMin    = slotMin === 0 ? 30 : 0;
  const endHour   = slotMin === 30 ? (sastHour + 1) % 24 : sastHour;
  const slotEnd   = `${pad(endHour)}:${pad(endMin)}:00`;

  return { slotStart, slotEnd };
}

/** Returns today's day name in lowercase SAST (e.g. "monday") */
export function getSastDayName(): string {
  return new Date().toLocaleDateString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
  }).toLowerCase();
}
