"use client";

import { useState, useEffect } from "react";

interface ModelOption {
  id: string;
  label: string;
  free: boolean;
}

export default function ModelDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        // Data is a plain array of strings now
        const modelList = data || [];
        const options = modelList.map((m: any) => ({
          id: m,
          label: m,
          free: !m.includes("/"),
        }));
        setModels(options);
        if (options.some((o) => o.id === value)) {
          onChange(value);
        } else if (options.length > 0) {
          onChange(options[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || models.length === 0) {
    return <select value={value} onChange={(e) => onChange(e.target.value)} disabled>
      <option value="">Loading models...</option>
    </select>;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#111116] border border-[#1a1a22] text-white text-sm px-3 py-2 cursor-pointer"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} {m.free ? "(FREE)" : "(PAID)"}
        </option>
      ))}
    </select>
  );
}
