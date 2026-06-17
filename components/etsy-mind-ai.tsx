"use client";

export default function EtsyMindAI() {
  return (
    <div style={{ padding: "40px", fontFamily: "monospace", background: "#080808", minHeight: "100vh", color: "#c8c8c8" }}>
      <h1 style={{ color: "#c8a96e", fontSize: "14px", letterSpacing: "0.2em" }}>ETSYMIND AI — mvpdealz</h1>
      <p style={{ color: "#585858", fontSize: "12px", marginTop: "8px" }}>Autonomous agents active. API endpoints ready.</p>
      <ul style={{ color: "#585858", fontSize: "11px", lineHeight: 2, marginTop: "16px" }}>
        <li>POST /api/run — trigger any agent manually</li>
        <li>GET /api/cron — daily autonomous run (9am UTC)</li>
        <li>GET /api/etsy/listings — view store listings</li>
      </ul>
    </div>
  );
}