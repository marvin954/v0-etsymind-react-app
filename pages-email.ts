import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.REPORT_EMAIL;
  if (!resendKey || !toEmail)
    return res.status(500).json({ error: "RESEND_API_KEY or REPORT_EMAIL not configured" });

  const { subject, analyticsData, createdProducts } = req.body;

  const products = (createdProducts || [])
    .map((p: { title: string; price: string }) => `<li><strong>${p.title}</strong> — ${p.price}</li>`)
    .join("");

  const insights = (analyticsData?.key_insights || [])
    .map((i: string) => `<li>${i}</li>`).join("");

  const actions = (analyticsData?.next_actions || [])
    .map((a: string) => `<li>${a}</li>`).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px">
      <h1 style="color:#FB5607;font-size:22px;margin-bottom:4px">🧠 EtsyMind AI Daily Report</h1>
      <p style="color:#888;margin-bottom:24px">${new Date().toDateString()}</p>
      <div style="background:#fff;border-radius:8px;padding:20px;margin-bottom:16px">
        <h2 style="font-size:15px;color:#333;margin-bottom:12px">📊 Store Performance</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Revenue This Month</td><td style="text-align:right;font-weight:700;color:#4ade80">${analyticsData?.revenue_this_month || "N/A"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Trend</td><td style="text-align:right;font-weight:700;color:#60a5fa">${analyticsData?.revenue_trend || "N/A"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Conversion Rate</td><td style="text-align:right;font-weight:700;color:#a78bfa">${analyticsData?.conversion_rate || "N/A"}</td></tr>
        </table>
      </div>
      ${products ? `<div style="background:#fff;border-radius:8px;padding:20px;margin-bottom:16px"><h2 style="font-size:15px;color:#333;margin-bottom:12px">🎨 New Products Created Today</h2><ul style="color:#555;padding-left:20px">${products}</ul></div>` : ""}
      ${insights ? `<div style="background:#fff;border-radius:8px;padding:20px;margin-bottom:16px"><h2 style="font-size:15px;color:#333;margin-bottom:12px">💡 Key Insights</h2><ul style="color:#555;padding-left:20px">${insights}</ul></div>` : ""}
      ${actions ? `<div style="background:#fff;border-radius:8px;padding:20px;margin-bottom:16px"><h2 style="font-size:15px;color:#333;margin-bottom:12px">🚀 Recommended Actions</h2><ul style="color:#555;padding-left:20px">${actions}</ul></div>` : ""}
      <p style="color:#aaa;font-size:11px;text-align:center;margin-top:24px">EtsyMind AI • Autonomous Etsy Store Manager • Daily at 9am UTC</p>
    </div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: "EtsyMind AI <onboarding@resend.dev>", to: toEmail, subject: subject || "EtsyMind AI Daily Report", html }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.status(200).json({ success: true, id: data.id });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown" });
  }
}
