import React from "react";
import ThemeProvider from "../../components/ui/ThemeProvider";
import GlassCard from "../../components/ui/GlassCard";
import SponsorFeed from "../SponsorFeed";
import SponsorBottomNav from "../../components/nav/SponsorBottomNav";
import SponsorTopBar from "../../components/sponsor/SponsorTopBar";

// Mirror MentorHome behavior for Sponsors: same gradient theme, top bar, feed, and bottom nav
export default function SponsorHome() {
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [bottomPad, setBottomPad] = React.useState(96);

  React.useEffect(() => {
    const handler = () => setComposerOpen(true);
    window.addEventListener("open-post-composer", handler);
    return () => window.removeEventListener("open-post-composer", handler);
  }, []);

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
            <div className="pt-2 px-4" style={{ paddingBottom: bottomPad }}>
              <div className="mx-auto max-w-6xl">
                <div className="mt-4">
                  <SponsorFeed />
                </div>
              </div>
            </div>
            <SponsorBottomNav />
          </div>

          {composerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setComposerOpen(false)} />
              <div className="relative w-full max-w-3xl">
                <GlassCard className="p-4 max-h-[85vh] overflow-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-white/90 font-medium">Create Post</div>
                    <button className="glass-btn px-3 py-1.5 text-sm" onClick={() => setComposerOpen(false)}>Close</button>
                  </div>
                  <div className="text-white/80 text-sm">
                    Posting from sponsor account isn’t available yet.
                  </div>
                </GlassCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
