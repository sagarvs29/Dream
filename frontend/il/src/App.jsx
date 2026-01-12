import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SplashScreen from "./SplashScreen";
import SignupPage from "./SignupPage";
import LoginPage from "./LoginPage";
import StudentHome from "./pages/student/Home";
import StudentMessages from "./pages/student/Messages.jsx";
import StudentProfile from "./pages/student/Profile.jsx";
import StudentSchool from "./pages/student/School.jsx";
import StudentLibrary from "./pages/student/Library.jsx";
import AchievementsPage from "./pages/student/Achievements.jsx";
import ProjectsPage from "./pages/student/Projects.jsx";
import NetworkPage from "./pages/student/Network.jsx";
import Feed from "./pages/student/Feed.jsx";
import HomePortal from "./portal/HomePortal";
import PortalSignup from "./portal/PortalSignup";
import PortalLogin from "./portal/PortalLogin";
import AdminLogin from "./portal/AdminLogin";
import AdminDashboard from "./portal/AdminDashboard";
// New split-login and admin flows
import EntryLogin from "./portal/EntryLogin";
import ServerAdminLogin from "./portal/ServerAdminLogin";
import SchoolAdminLogin from "./portal/SchoolAdminLogin";
import ChangePassword from "./portal/ChangePassword";
import ServerDashboard from "./portal/ServerDashboard";
import SchoolDashboard from "./portal/SchoolDashboard";
import ProtectedRoute from "./portal/ProtectedRoute";
import ProtectedAny from "./portal/ProtectedAny";
import MentorLogin from "./portal/MentorLogin";
import ProtectedMentor from "./portal/ProtectedMentor";
import MentorDashboard from "./portal/MentorDashboard";
import MentorProfile from "./portal/mentor/MentorProfile";
import MentorChangePassword from "./portal/mentor/ChangePassword";
import ThemeProvider from "./components/ui/ThemeProvider";
import StudentLayout from "./layouts/StudentLayout";
import SearchPage from "./pages/student/Search";
import PostView from "./pages/student/PostView";
import SponsorsExplore from "./pages/student/SponsorsExplore";
import StudentProgress from "./pages/student/Progress.jsx";
import SponsorNew from "./portal/admin/SponsorNew";
import SponsorDashboard from "./portal/admin/SponsorDashboard";
import ProtectedSponsor from "./portal/ProtectedSponsor";
import SponsorLogin from "./portal/sponsor/SponsorLogin";
import SponsorHome from "./portal/sponsor/SponsorHome";
import SponsorProfile from "./portal/sponsor/SponsorProfile";
import SponsorStudents from "./portal/sponsor/SponsorStudents";
import MentorInstitution from "./portal/MentorInstitution";
import InstitutionHub from "./portal/InstitutionHub";
import TeacherActions from "./portal/TeacherActions";

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Splash loads first */}
        <Route path="/" element={<SplashScreen />} />

        {/* Auth routes */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Legacy route now redirects to the new student home */}
        <Route path="/home" element={<Navigate to="/app/home" replace />} />
        {/* New Student App area with shared layout + bottom nav */}
        <Route element={<ProtectedAny />}>
          <Route path="/app" element={<StudentLayout />}>
            <Route path="home" element={<StudentHome />} />
            <Route path="messages" element={<StudentMessages />} />
            <Route path="library" element={<StudentLibrary />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="school" element={<StudentSchool />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="network" element={<NetworkPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="feed" element={<Feed />} />
            <Route path="sponsors" element={<SponsorsExplore />} />
            <Route path="progress" element={<StudentProgress />} />
            {/* Institution hub under /app so Mentor nav stays consistent */}
            <Route path="institution" element={<ProtectedMentor><InstitutionHub /></ProtectedMentor>} />
          </Route>
        </Route>
        {/* Publicly viewable post page (use student layout to keep bottom nav visible) */}
        <Route path="/app/post/:id" element={<StudentLayout />}>
          <Route index element={<PostView />} />
        </Route>
        {/* Portal routes */}
        <Route path="/portal" element={<HomePortal />} />
  {/* Unified Institution hub for all roles (placeholder) */}
  <Route path="/institution" element={<ProtectedAny><InstitutionHub /></ProtectedAny>} />
  <Route path="/institution/teacher/:id" element={<ProtectedRoute role="SCHOOL"><TeacherActions /></ProtectedRoute>} />
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal/signup" element={<PortalSignup />} />
        <Route path="/portal/admin/login" element={<AdminLogin />} />
        <Route path="/portal/admin" element={<AdminDashboard />} />
        {/* Split login entry and role-specific routes */}
        <Route path="/admin/login" element={<EntryLogin />} />
        <Route path="/admin" element={<EntryLogin />} />
        <Route path="/login/server" element={<ServerAdminLogin />} />
        <Route path="/login/school" element={<SchoolAdminLogin />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/server" element={<ProtectedRoute role="SERVER"><ServerDashboard /></ProtectedRoute>} />
        <Route path="/school" element={<ProtectedRoute role="SCHOOL"><SchoolDashboard /></ProtectedRoute>} />
        {/* Admin sponsor creation for server and school */}
        <Route path="/server/sponsors/new" element={<ProtectedRoute role="SERVER"><SponsorNew /></ProtectedRoute>} />
        <Route path="/school/sponsors/new" element={<ProtectedRoute role="SCHOOL"><SponsorNew /></ProtectedRoute>} />
        <Route path="/server/sponsors" element={<ProtectedRoute role="SERVER"><SponsorDashboard /></ProtectedRoute>} />
        <Route path="/school/sponsors" element={<ProtectedRoute role="SCHOOL"><SponsorDashboard /></ProtectedRoute>} />
        {/* Sponsor portal */}
        <Route path="/sponsor/login" element={<SponsorLogin />} />
        <Route element={<ProtectedSponsor />}>
          <Route path="/sponsor/home" element={<SponsorHome />} />
          <Route path="/sponsor/students" element={<SponsorStudents />} />
          <Route path="/sponsor/profile" element={<SponsorProfile />} />
        </Route>
  {/* Mentor portal */}
  <Route path="/mentor/login" element={<MentorLogin />} />
  <Route path="/mentor" element={<ProtectedMentor><MentorDashboard /></ProtectedMentor>} />
  <Route path="/mentor/profile" element={<ProtectedMentor><MentorProfile /></ProtectedMentor>} />
  <Route path="/mentor/change-password" element={<ProtectedMentor><MentorChangePassword /></ProtectedMentor>} />
      </Routes>
    </Router>
  );
};

export default App;
