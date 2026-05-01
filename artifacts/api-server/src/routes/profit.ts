import { Router, Request, Response } from "express";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ProductInput {
  name: string;
  inventory: number;
  dailySales: number;
  leadTime: number;
  reorderPoint: number;
  daysLeft: number;
  status: string;
  orderQuantity: number;
}

router.post("/", async (req: Request, res: Response) => {
  const { products, avgPrice, holdingCostPct } = req.body as {
    products: ProductInput[];
    avgPrice: number;
    holdingCostPct: number;
  };

  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: "products array required" });
    return;
  }

  const price = typeof avgPrice === "number" && avgPrice > 0 ? avgPrice : null;
  const holdingPct = typeof holdingCostPct === "number" && holdingCostPct > 0 ? holdingCostPct : 25;

  const highRisk = products.filter((p) => p.status === "High Risk");
  const mediumRisk = products.filter((p) => p.status === "Medium Risk");
  const healthy = products.filter((p) => p.status === "Healthy");

  const totalOrderUnits = products.reduce((s, p) => s + p.orderQuantity, 0);

  let metricsSection = "";
  let revenueAtRisk: number | null = null;
  let reorderInvestment: number | null = null;
  let annualHoldingCost: number | null = null;
  let dailyRevenueAtRisk: number | null = null;

  if (price !== null) {
    revenueAtRisk = highRisk.reduce((sum, p) => {
      const daysUntilStockout = p.daysLeft === 999 ? 0 : p.daysLeft;
      return sum + p.dailySales * Math.max(0, p.leadTime - daysUntilStockout) * price;
    }, 0);
    dailyRevenueAtRisk = highRisk.reduce((s, p) => s + p.dailySales * price, 0);
    reorderInvestment = totalOrderUnits * price;
    const totalInventoryValue = products.reduce((s, p) => s + p.inventory * price, 0);
    annualHoldingCost = totalInventoryValue * (holdingPct / 100);
    metricsSection = `
Quantitative context (avg price = $${price}/unit, holding cost = ${holdingPct}%/yr):
- Revenue at risk from high-risk stockouts: ~$${revenueAtRisk.toFixed(0)}
- Daily revenue exposed (high-risk items only): ~$${dailyRevenueAtRisk.toFixed(0)}/day
- Total reorder investment needed: ~$${reorderInvestment.toFixed(0)}
- Current total inventory value: ~$${(products.reduce((s, p) => s + p.inventory * price, 0)).toFixed(0)}
- Estimated annual holding cost at ${holdingPct}% rate: ~$${annualHoldingCost.toFixed(0)}
`;
  } else {
    metricsSection = "No price data provided — give unit-agnostic analysis using percentages and relative comparisons.";
  }

  const productList = products
    .map(
      (p) =>
        `- ${p.name}: ${p.inventory} units, ${p.dailySales}/day sales, ${p.leadTime}d lead, ${p.daysLeft === 999 ? "∞" : p.daysLeft}d remaining, status=${p.status}, order=${p.orderQuantity} units`
    )
    .join("\n");

  const prompt = `You are an expert inventory analyst and CFO advisor. Analyze the following inventory data and provide a clear, actionable profit impact assessment.

INVENTORY SNAPSHOT:
${productList}

RISK SUMMARY:
- High Risk: ${highRisk.length} items
- Medium Risk: ${mediumRisk.length} items
- Healthy: ${healthy.length} items
- Total units to reorder: ${totalOrderUnits}

${metricsSection}

Provide a concise profit impact analysis covering:
1. **Revenue Risk**: Quantify (or estimate proportionally) the revenue at risk from potential stockouts
2. **Stockout Cost vs. Reorder Cost**: Compare the cost of NOT ordering versus ordering
3. **Holding Cost Concern**: Flag any products with unusually high inventory relative to demand
4. **Priority Action**: A single most-important action to protect profit margin this week
5. **30-Day Outlook**: Overall profit health forecast if current trends continue

Keep the tone direct and data-driven. Maximum 250 words. Use specific product names when making recommendations. Format each section with a clear label.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 500,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";

    res.json({
      analysis: text,
      metrics: {
        revenueAtRisk,
        reorderInvestment,
        annualHoldingCost,
        dailyRevenueAtRisk,
        highRiskCount: highRisk.length,
        mediumRiskCount: mediumRisk.length,
        healthyCount: healthy.length,
        totalOrderUnits,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OpenAI error";
    res.status(500).json({ error: msg });
  }
});

export default router;
