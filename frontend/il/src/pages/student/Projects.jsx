import React from "react";
import GlassCard from "../../components/ui/GlassCard";

export default function ProjectsPage() {
  const profile = (() => {
    try { return JSON.parse(sessionStorage.getItem("enhancedProfile") || "null"); } catch { return null; }
  })();
  const list = profile?.projects || [
    "Smart Irrigation System",
    "Student Network App",
  ];
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="mx-auto max-w-4xl px-4 pt-5 pb-24">
        <div className="text-white/90 font-semibold mb-3">Projects</div>
        <GlassCard className="p-4">
          <ul className="text-white/85 list-disc ml-5 space-y-2">
            {list.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
