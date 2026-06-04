import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const shopId = process.env.ETSY_SHOP_ID;
  const token = process.env.ETSY_ACCESS_TOKEN;
  const keystring = process.env.ETSY_KEYSTRING;

  if (!shopId || !token || !keystring)
    return res.status(500).json({ error: "Missing ETSY_SHOP_ID, ETSY_ACCESS_TOKEN or ETSY_KEYSTRING" });

  const headers = { "x-api-key": keystring, Authorization: `Bearer ${token}` };

  try {
    const [receiptsRes, shopRes] = await Promise.all([
      fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/receipts?limit=100&was_paid=true`, { headers }),
      fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}`, { headers }),
    ]);

    const receipts = await receiptsRes.json();
    const shop = await shopRes.json();

    const orders = receipts.results || [];
    const totalRevenue = orders.reduce(
      (sum: number, r: { grandtotal?: { amount: number; divisor: number } }) =>
        sum + (r.grandtotal?.amount || 0) / (r.grandtotal?.divisor || 100), 0
    );

    return res.status(200).json({
      total_revenue: `$${totalRevenue.toFixed(2)}`,
      order_count: orders.length,
      shop_name: shop.shop_name,
      total_sales: shop.transaction_sold_count,
      review_count: shop.review_count,
      review_average: shop.review_average,
      recent_orders: orders.slice(0, 10).map((r: {
        receipt_id: number;
        grandtotal?: { amount: number; divisor: number };
        create_timestamp: number;
        status: string;
      }) => ({
        id: r.receipt_id,
        amount: `$${((r.grandtotal?.amount || 0) / (r.grandtotal?.divisor || 100)).toFixed(2)}`,
        date: new Date(r.create_timestamp * 1000).toLocaleDateString(),
        status: r.status,
      })),
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown" });
  }
}
