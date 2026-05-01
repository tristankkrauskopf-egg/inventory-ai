import { Router } from "express";
import { Resend } from "resend";

const router = Router();

type AtRiskProduct = {
  name: string;
  inventory: number;
  dailySales: number;
  leadTime: number;
  reorderPoint: number;
  daysLeft: number;
  status: "High Risk" | "Medium Risk";
  action: string;
  orderQuantity: number;
};

router.post("/alert", async (req, res) => {
  const { email, products } = req.body as {
    email: string;
    products: AtRiskProduct[];
  };

  if (!email || !products?.length) {
    res.status(400).json({ error: "Missing email or products" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Email service not configured. Please connect Resend." });
    return;
  }

  const resend = new Resend(apiKey);

  const highRisk = products.filter((p) => p.status === "High Risk");
  const mediumRisk = products.filter((p) => p.status === "Medium Risk");

  const productRows = products
    .map(
      (p) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 12px 16px; font-weight: 500; color: #111;">${p.name}</td>
        <td style="padding: 12px 16px; text-align: right; color: #374151;">${p.inventory.toLocaleString()}</td>
        <td style="padding: 12px 16px; text-align: right; color: #374151;">${p.daysLeft === 999 ? "∞" : p.daysLeft + "d"}</td>
        <td style="padding: 12px 16px; text-align: right; color: #374151;">${p.orderQuantity.toLocaleString()}</td>
        <td style="padding: 12px 16px;">
          <span style="
            display: inline-flex; align-items: center; gap: 6px;
            padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600;
            background: ${p.status === "High Risk" ? "#fef2f2" : "#fffbeb"};
            color: ${p.status === "High Risk" ? "#b91c1c" : "#b45309"};
            border: 1px solid ${p.status === "High Risk" ? "#fecaca" : "#fde68a"};
          ">${p.status}</span>
        </td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc;">
  <div style="max-width: 640px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

    <div style="background: #1e293b; padding: 28px 32px; display: flex; align-items: center; gap: 12px;">
      <div style="width: 36px; height: 36px; background: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 18px;">📦</span>
      </div>
      <div>
        <div style="color: #fff; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">StockSense Alert</div>
        <div style="color: #94a3b8; font-size: 13px; margin-top: 2px;">Inventory reorder intelligence</div>
      </div>
    </div>

    <div style="padding: 28px 32px 20px;">
      ${highRisk.length > 0 ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px;">
        <span style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">🚨</span>
        <div>
          <div style="font-weight: 700; color: #b91c1c; font-size: 14px;">${highRisk.length} product${highRisk.length > 1 ? "s" : ""} at HIGH RISK</div>
          <div style="color: #991b1b; font-size: 13px; margin-top: 3px;">These items are below the reorder point and require immediate action to prevent stockouts.</div>
        </div>
      </div>` : ""}

      ${mediumRisk.length > 0 ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px;">
        <span style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">⚠️</span>
        <div>
          <div style="font-weight: 700; color: #b45309; font-size: 14px;">${mediumRisk.length} product${mediumRisk.length > 1 ? "s" : ""} need review</div>
          <div style="color: #92400e; font-size: 13px; margin-top: 3px;">These items are approaching the reorder point and should be ordered soon.</div>
        </div>
      </div>` : ""}

      <h2 style="font-size: 15px; font-weight: 600; color: #374151; margin: 0 0 12px;">Products Requiring Attention</h2>

      <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Product</th>
            <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Stock</th>
            <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Days Left</th>
            <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Order Qty</th>
            <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
          </tr>
        </thead>
        <tbody>${productRows}</tbody>
      </table>
    </div>

    <div style="padding: 0 32px 28px;">
      <p style="font-size: 13px; color: #6b7280; margin: 20px 0 0;">
        Log in to your StockSense dashboard to view full AI analysis and take action.
      </p>
    </div>

    <div style="background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 16px 32px; text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">Sent by StockSense &mdash; Inventory reorder intelligence</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "StockSense Alerts <onboarding@resend.dev>",
      to: [email],
      reply_to: email,
      subject: `StockSense Alert: ${highRisk.length > 0 ? `${highRisk.length} item${highRisk.length > 1 ? "s" : ""} at high risk` : `${mediumRisk.length} item${mediumRisk.length > 1 ? "s" : ""} need review`}`,
      html,
    });

    if (error) {
      req.log.error({ error }, "Resend error");
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send alert email");
    res.status(500).json({ error: "Failed to send email. Please try again." });
  }
});

export default router;
