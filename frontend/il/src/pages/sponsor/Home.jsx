import React from "react";
import SponsorBottomNav from "../../components/nav/SponsorBottomNav";
import SponsorSummary from "../../components/sidebar/SponsorSummary";
import GlassCard from "../../components/ui/GlassCard";

export default function SponsorHome() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="px-4 pt-4">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div>
            <GlassCard className="p-4 text-white/90">
              <div className="font-semibold mb-2">Welcome</div>
              <div className="text-white/80 text-sm">Discover students to support, or head to the Sponsor tab to contribute directly.</div>
            </GlassCard>
          </div>
          <div className="hidden lg:block">
            <SponsorSummary />
          </div>
        </div>
      </div>
      <SponsorBottomNav />
    </div>
  );
}
