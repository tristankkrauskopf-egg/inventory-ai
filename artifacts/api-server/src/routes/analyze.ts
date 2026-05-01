import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/analyze", async (req, res) => {
  const { product } = req.body as {
    product: {
      name: string;
      inventory: number;
      dailySales: number;
      leadTime: number;
      reorderPoint: number;
      daysLeft: number;
      status: string;
      action: string;
      orderQuantity: number;
    };
  };

  if (!product || !product.name) {
    res.status(400).json({ error: "Missing product data" });
    return;
  }

  try {
    const prompt = `You are an inventory management expert. A business is tracking their product inventory and needs your analysis.

Product: ${product.name}
Current Inventory: ${product.inventory} units
Daily Sales Rate: ${product.dailySales} units/day
Supplier Lead Time: ${product.leadTime} days
Reorder Point: ${product.reorderPoint} units
Days of Stock Remaining: ${product.daysLeft === 999 ? "unlimited (no daily sales)" : `${product.daysLeft} days`}
Risk Status: ${product.status}
Recommended Action: ${product.action}
Suggested Order Quantity: ${product.orderQuantity} units

Write a concise, practical recommendation (2-3 sentences) for the inventory manager. Be specific about urgency, the numbers, and what to do. Do not use bullet points. Speak directly and professionally.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.4,
    });

    const explanation = completion.choices[0]?.message?.content?.trim() ?? "No analysis available.";
    res.json({ explanation });
  } catch (err) {
    req.log.error({ err }, "OpenAI request failed");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

export default router;
