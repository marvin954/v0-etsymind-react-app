const INITIAL_STATE = {
  storeInfo: { name: "My Etsy Store", niche: "Digital Printables", rating: 0, totalSales: 0 },
  listings: [] as Array<{ id: string; title: string; price: string; status: string; views: number; sales: number }>,
  messages: [] as Array<{ from: string; issue: string; orderId: string }>,
  salesData: { thisMonth: 0, lastMonth: 0, orders: 0, avgOrderValue: 0 },
};
