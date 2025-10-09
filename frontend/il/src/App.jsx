import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SplashScreen from "./SplashScreen";
import SignupPage from "./SignupPage";
import LoginPage from "./LoginPage";
import HomePage from "./Homepage";
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

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Splash loads first */}
        <Route path="/" element={<SplashScreen />} />

        {/* Auth routes */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Main app */}
        <Route
          path="/home"
          element={
            <ProtectedAny>
              <HomePage />
            </ProtectedAny>
          }
        />
  {/* Portal routes */}
  <Route path="/portal" element={<HomePortal />} />
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
        {/* Mentor portal */}
        <Route path="/mentor/login" element={<MentorLogin />} />
        <Route path="/mentor" element={<ProtectedMentor><MentorDashboard /></ProtectedMentor>} />
      </Routes>
    </Router>
  );
};

export default App;
