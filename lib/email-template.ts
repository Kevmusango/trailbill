const PRIMARY = "#0DA2E7";
const DARK    = "#1a1a1a";
const MUTED   = "#6b7280";
const BORDER  = "#e5e7eb";
const BG      = "#f9fafb";

function fmtMoney(n: number) {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function emailBase({
  title,
  subtitle,
  businessName,
  body,
  logoUrl,
}: {
  title: string;
  subtitle: string;
  businessName: string;
  body: string;
  logoUrl?: string | null;
}) {
  const logoSrc = logoUrl || "https://trailbill.com/logo.png";
  const logoHtml = `<img src="${logoSrc}" alt="${logoUrl ? businessName : "TrailBill"}" style="height:36px;width:auto;object-fit:contain;display:block;margin-bottom:10px;" />`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:system-ui,-apple-system,sans-serif;color:${DARK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

        <!-- Header -->
        <tr><td style="background:${PRIMARY};border-radius:12px 12px 0 0;padding:24px 28px;">
          ${logoHtml}
          <h1 style="margin:4px 0 0;font-size:22px;font-weight:700;color:#fff;">${title}</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.9);"><strong>${businessName}</strong> &middot; ${subtitle}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};padding:28px;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${BG};border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
          <p style="margin:0;font-size:11px;color:${MUTED};">
            Powered by <a href="https://www.trailbill.com" style="color:${PRIMARY};text-decoration:none;font-weight:600;">TrailBill</a>
            &nbsp;&middot;&nbsp;
            <a href="https://app.trailbill.com/dashboard/settings" style="color:${MUTED};text-decoration:none;">Manage report settings</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function statRow(label: string, value: string, highlight = false) {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid ${BORDER};font-size:13px;font-weight:700;text-align:right;color:${highlight ? PRIMARY : DARK};">${value}</td>
  </tr>`;
}

export function sectionHeader(text: string) {
  return `<h3 style="margin:24px 0 10px;font-size:13px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;">${text}</h3>`;
}

export function clientRow(name: string, detail: string, amount: string, red = false) {
  const nameColor   = red ? "#DC2626" : DARK;
  const detailColor = red ? "#ef4444" : MUTED;
  const amountColor = red ? "#DC2626" : PRIMARY;
  const rowBg       = red ? "background:#fff5f5;" : "";
  return `
  <tr style="${rowBg}">
    <td style="padding:8px 0;border-bottom:1px solid ${BORDER};">
      <p style="margin:0;font-size:13px;font-weight:600;color:${nameColor};">${name}</p>
      <p style="margin:2px 0 0;font-size:11px;color:${detailColor};">${detail}</p>
    </td>
    <td style="padding:8px 0;border-bottom:1px solid ${BORDER};text-align:right;font-size:13px;font-weight:700;color:${amountColor};">${amount}</td>
  </tr>`;
}

export function statsBox(stats: { label: string; value: string; sub?: string; red?: boolean }[]) {
  const cells = stats.map(s => `
    <td style="text-align:center;padding:16px 12px;background:${s.red ? "#fff5f5" : BG};border:1px solid ${s.red ? "#FCA5A5" : BORDER};border-radius:8px;width:${Math.floor(100 / stats.length)}%;">
      <p style="margin:0;font-size:20px;font-weight:800;color:${s.red ? "#DC2626" : PRIMARY};">${s.value}</p>
      <p style="margin:4px 0 0;font-size:11px;color:${MUTED};">${s.label}</p>
      ${s.sub ? `<p style="margin:2px 0 0;font-size:10px;color:${s.red ? "#ef4444" : MUTED};">${s.sub}</p>` : ""}
    </td>`).join('<td style="width:8px;"></td>');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr>${cells}</tr></table>`;
}

export function progressBar(pct: number) {
  const clamped  = Math.min(100, Math.max(0, pct));
  const barColor = clamped < 40 ? "#DC2626" : clamped < 70 ? "#f59e0b" : PRIMARY;
  return `
  <div style="margin:12px 0;">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:11px;color:${MUTED};">Collection rate</span>
      <span style="font-size:11px;font-weight:700;color:${barColor};">${clamped}%</span>
    </div>
    <div style="background:${BORDER};border-radius:99px;height:6px;overflow:hidden;">
      <div style="background:${barColor};width:${clamped}%;height:6px;border-radius:99px;"></div>
    </div>
  </div>`;
}

export function emptyState(text: string) {
  return `<p style="text-align:center;font-size:13px;color:${MUTED};padding:16px 0;">${text}</p>`;
}

export function impactBanner({ reminders, hoursSaved }: { reminders: number; hoursSaved: string }) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:linear-gradient(135deg,#0DA2E7 0%,#0284c7 100%);border-radius:10px;">
    <tr>
      <td style="padding:18px 20px;">
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);">This month, TrailBill worked for you</p>
        <p style="margin:0;font-size:20px;font-weight:800;color:#fff;">${reminders} reminder${reminders !== 1 ? "s" : ""} sent on your behalf</p>
        <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.85);">That&rsquo;s ~${hoursSaved} hours you didn&rsquo;t spend chasing clients manually.</p>
      </td>
    </tr>
  </table>`;
}

export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function ctaButton(text: string, url: string) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
    <tr><td align="center">
      <a href="${url}" style="display:inline-block;background:${PRIMARY};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;">${text}</a>
    </td></tr>
  </table>`;
}

export function alertHeader(text: string) {
  return `<h3 style="margin:24px 0 8px;font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.08em;">&#9888; ${text}</h3>`;
}

export function attentionBox(rows: string) {
  if (!rows.trim()) return "";
  return `
  <div style="border:1.5px solid #FCA5A5;border-radius:8px;padding:4px 12px;margin:0 0 16px;background:#fff5f5;">
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </div>`;
}

export { fmtMoney };
