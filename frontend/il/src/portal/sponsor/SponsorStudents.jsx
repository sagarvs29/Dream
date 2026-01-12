import React from "react";
import ThemeProvider from "../../components/ui/ThemeProvider";
import SponsorTopBar from "../../components/sponsor/SponsorTopBar";
import SponsorBottomNav from "../../components/nav/SponsorBottomNav";
import SponsorFeed from "../SponsorFeed";
import GlassCard from "../../components/ui/GlassCard";

// Students view for sponsors: shows recent student posts (all posts authored by students)
// Reuses SponsorFeed until a dedicated backend filtering endpoint exists.
export default function SponsorStudents() {
  const [bottomPad, setBottomPad] = React.useState(96);
  React.useEffect(() => {
    function onNavHeight(e){
      const h = (e?.detail && Number(e.detail)) || 96;
      setBottomPad(h + 12);
    }
    window.addEventListener('sponsor-nav-height', onNavHeight);
    return () => window.removeEventListener('sponsor-nav-height', onNavHeight);
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a]">
        <div className="min-h-screen w-full relative">
          <div className="relative z-10">
            <SponsorTopBar />
            <div className="px-4 pt-4" style={{ paddingBottom: bottomPad }}>
              <div className="mx-auto max-w-6xl">
                <GlassCard className="p-4 mb-4">
                  <div className="text-white/90 font-semibold text-lg">Students</div>
                  <div className="text-white/75 text-sm mt-1">Recent posts from students across the platform. School-only posts appear if they are public or your sponsored school relationship allows visibility.</div>
                </GlassCard>
                <SponsorFeed />
              </div>
            </div>
            <SponsorBottomNav />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
