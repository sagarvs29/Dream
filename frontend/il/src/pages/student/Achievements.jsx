import React from "react";
import GlassCard from "../../components/ui/GlassCard";

export default function AchievementsPage() {
  const profile = (() => {
    try { return JSON.parse(sessionStorage.getItem("enhancedProfile") || "null"); } catch { return null; }
  })();
  const list = profile?.achievements || [
    "Top 10 in Regional Hackathon",
    "Open-source contributor",
    "Winner - School Science Fair",
  ];
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-4xl px-4 pt-5 pb-24">
        <div className="text-white/90 font-semibold mb-3">Achievements</div>
        <GlassCard className="p-4">
          <ul className="text-white/85 list-disc ml-5 space-y-2">
            {list.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
