import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const keystring = process.env.ETSY_KEYSTRING;
  if (!keystring) return res.status(500).json({ error: "ETSY_KEYSTRING not configured" });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/etsy/callback`;
  const codeChallenge = "DSWlX90ZZNM_ZeKJ_e4HxYJLiMT-TtMa1_CAoVHjINg";

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "listings_w listings_r shops_r transactions_r",
    client_id: keystring,
    state: "etsymind_auth",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(`https://www.etsy.com/oauth/connect?${params.toString()}`);
}
