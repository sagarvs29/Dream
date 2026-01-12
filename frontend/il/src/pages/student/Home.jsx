import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";
import StudentBottomNav from "../../components/nav/StudentBottomNav";
import PostsFeed from "../../components/posts/PostsFeed";
import SponsorsSidebar from "../../components/sidebar/SponsorsSidebar";
import PostComposer from "../../components/PostComposer";
import TopBar from "../../components/student/TopBar";
import StudentTopBar from "../../components/student/StudentTopBar";
import SuggestedStrip from "../../components/student/SuggestedStrip";

export default function StudentHome() {
  const [composerOpen, setComposerOpen] = React.useState(false);
  const location = useLocation();
  const nav = useNavigate();
  React.useEffect(() => {
    // Open composer modal only when explicitly requested via navigation state
    if (location.state?.openComposerModal) {
      setComposerOpen(true);
      // Clear the state to avoid auto-open on future visits or refreshes
      nav(".", { replace: true, state: {} });
      setTimeout(() => {
        const el = document.querySelector('[data-post-composer] textarea');
        try { el?.focus(); } catch (_) {}
      }, 150);
    }
  }, [location.state, nav]);

  // Listen for bottom-nav event to open modal
  React.useEffect(() => {
    const handler = () => {
      setComposerOpen(true);
      setTimeout(() => {
        const el = document.querySelector('[data-post-composer] textarea');
        try { el?.focus(); } catch (_) {}
      }, 120);
    };
    window.addEventListener("open-post-composer", handler);
    return () => window.removeEventListener("open-post-composer", handler);
  }, []);

  // Navigate to Institution hub when the TopBar's Institution button is clicked (student view)
  React.useEffect(() => {
    function gotoInstitution(){
      try { window.location.href = "/institution"; } catch(_) {}
    }
    window.addEventListener('institution-button-click', gotoInstitution);
    return () => window.removeEventListener('institution-button-click', gotoInstitution);
  }, []);

  return (
    <div className="min-h-screen w-full relative">
      <div className="relative z-10">
  {/* Use student wrapper with Logout button */}
  <StudentTopBar />
        {/* Mobile suggestions strip */}
        <div className="pt-2 px-4 block lg:hidden">
          <SuggestedStrip />
        </div>
        <div className="pt-2 px-4">
          <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div>
              <div className="mt-4">
                <PostsFeed />
              </div>
            </div>
            <div className="hidden lg:block">
              <SponsorsSidebar />
            </div>
          </div>
        </div>
        <StudentBottomNav />
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
              <div>
                <PostComposer onPostCreated={(post) => {
                  // Close modal and broadcast that a post was created so feed can prepend
                  setComposerOpen(false);
                  try {
                    window.dispatchEvent(new CustomEvent('post-created', { detail: post }));
                  } catch (_) {}
                }} />
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
