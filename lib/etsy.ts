// Etsy API client with automatic token refresh

const ETSY_BASE = "https://api.etsy.com/v3";

function getHeaders() {
  const apiKey = process.env.ETSY_API_KEY!;
  const token = process.env.ETSY_ACCESS_TOKEN!;
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "Authorization": `Bearer ${token}`,
  };
}

export async function etsyGet(path: string) {
  const res = await fetch(`${ETSY_BASE}${path}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Etsy GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function etsyPost(path: string, body: object) {
  const res = await fetch(`${ETSY_BASE}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Etsy POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function etsyPatch(path: string, body: object) {
  const res = await fetch(`${ETSY_BASE}${path}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Etsy PATCH ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshEtsyToken(): Promise<string> {
  const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_KEYSTRING,
      refresh_token: process.env.ETSY_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token refresh failed: " + JSON.stringify(data));
  return data.access_token;
}

export const SHOP_ID = process.env.ETSY_SHOP_ID!;