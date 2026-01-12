import React from "react";
import ThemeProvider from "../components/ui/ThemeProvider";
import MentorTopBar from "../components/mentor/MentorTopBar";
import { Navigate } from "react-router-dom";

export default function MentorInstitution() {
  const [bottomPad, setBottomPad] = React.useState(96);
  React.useEffect(() => {
    function onNavHeight(e){
      const h = (e?.detail && Number(e.detail)) || 96;
      setBottomPad(h + 12);
    }
    window.addEventListener('mentor-nav-height', onNavHeight);
    return () => window.removeEventListener('mentor-nav-height', onNavHeight);
  }, []);

  // Redirect mentors away from Institution Copilot page
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a]">
        <div className="min-h-screen w-full relative">
          <div className="relative z-10">
            <MentorTopBar />
            <Navigate to="/mentor" replace />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
