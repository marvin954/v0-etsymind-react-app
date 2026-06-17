import { NextRequest, NextResponse } from "next/server";

const ETSY_BASE = "https://openapi.etsy.com/v3";

export async function GET(req: NextRequest) {
  const shopId = process.env.ETSY_SHOP_ID;
  const token = process.env.ETSY_ACCESS_TOKEN;
  const apiKey = process.env.ETSY_API_KEY;

  if (!shopId || !token) {
    return NextResponse.json({ error: "ETSY_SHOP_ID or ETSY_ACCESS_TOKEN not set" }, { status: 500 });
  }

  try {
    // Get recent receipts (orders)
    const receiptsRes = await fetch(
      `${ETSY_BASE}/application/shops/${shopId}/receipts?limit=100&was_paid=true`,
      {
        headers: {
          "x-api-key": apiKey!,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const receipts = await receiptsRes.json();

    // Calculate revenue
    const orders = receipts.results || [];
    const totalRevenue = orders.reduce((sum: number, r: { grandtotal?: { amount: number; divisor: number } }) =>
      sum + (r.grandtotal?.amount || 0) / (r.grandtotal?.divisor || 100), 0
    );

    // Get shop stats
    const statsRes = await fetch(
      `${ETSY_BASE}/application/shops/${shopId}`,
      { headers: { "x-api-key": apiKey!, Authorization: `Bearer ${token}` } }
    );
    const shop = await statsRes.json();

    return NextResponse.json({
      total_revenue: totalRevenue.toFixed(2),
      order_count: orders.length,
      shop_name: shop.shop_name,
      total_sales: shop.transaction_sold_count,
      review_count: shop.review_count,
      review_average: shop.review_average,
      orders: orders.slice(0, 10).map((r: {
        receipt_id: number;
        grandtotal?: { amount: number; divisor: number };
        create_timestamp: number;
        status: string;
      }) => ({
        id: r.receipt_id,
        amount: ((r.grandtotal?.amount || 0) / (r.grandtotal?.divisor || 100)).toFixed(2),
        date: new Date(r.create_timestamp * 1000).toLocaleDateString(),
        status: r.status,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
