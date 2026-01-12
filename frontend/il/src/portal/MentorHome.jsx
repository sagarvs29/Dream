import React from "react";
import GlassCard from "../components/ui/GlassCard";
import MentorTopBar from "../components/mentor/MentorTopBar";
import MentorBottomNav from "../components/nav/MentorBottomNav";
import MentorFeed from "./MentorFeed";

// StudentHome-identical layout but with mentor-specific feed
export default function MentorHome() {
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [bottomPad, setBottomPad] = React.useState(96);
  const navRef = React.useRef(null);

  React.useEffect(() => {
    const handler = () => setComposerOpen(true);
    window.addEventListener("open-post-composer", handler);
    return () => window.removeEventListener("open-post-composer", handler);
  }, []);

  // Navigate to Institution page when the TopBar's Institution button is clicked
  React.useEffect(() => {
    function gotoInstitution(){
      try { window.location.href = "/app/institution"; } catch(_) {}
    }
    window.addEventListener('institution-button-click', gotoInstitution);
    return () => window.removeEventListener('institution-button-click', gotoInstitution);
  }, []);

  React.useEffect(() => {
    function onNavHeight(e){
      const h = (e?.detail && Number(e.detail)) || 96;
      setBottomPad(h + 12); // add a little extra breathing room
    }
    window.addEventListener('mentor-nav-height', onNavHeight);
    return () => window.removeEventListener('mentor-nav-height', onNavHeight);
  }, []);

  return (
    <div className="min-h-screen w-full relative">
      <div className="relative z-10">
        <MentorTopBar />
        <div className="pt-2 px-4" style={{ paddingBottom: bottomPad }}>
          <div className="mx-auto max-w-6xl">
            <div className="mt-4">
              <MentorFeed />
            </div>
          </div>
        </div>
  <MentorBottomNav ref={navRef} />
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
                Posting from mentor account isn’t available yet.
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
