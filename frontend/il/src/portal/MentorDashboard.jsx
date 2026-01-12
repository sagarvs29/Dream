import React from "react";
import ThemeProvider from "../components/ui/ThemeProvider";
import MentorHome from "./MentorHome";

// For now, mentors should see exactly the same UI as the student's home page.
// We reuse the StudentHome component and wrap it with the same gradient theme as StudentLayout.
export default function MentorDashboard() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a]">
        <MentorHome />
      </div>
    </ThemeProvider>
  );
}
