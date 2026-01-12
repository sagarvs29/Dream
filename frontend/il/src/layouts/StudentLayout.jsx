import React from "react";
import { Outlet } from "react-router-dom";
import ThemeProvider from "../components/ui/ThemeProvider";
import StudentBottomNav from "../components/nav/StudentBottomNav";
// Mentor bottom nav removed; consolidated under Teachers module

export default function StudentLayout() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a]">
        {/* Page content */}
        <Outlet />
        {/* Fixed rounded bottom navigation (includes its own spacer) */}
        <StudentBottomNav />
      </div>
    </ThemeProvider>
  );
}
