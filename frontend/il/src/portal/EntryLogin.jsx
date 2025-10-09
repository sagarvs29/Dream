import React from "react";
import { Link } from "react-router-dom";

export default function EntryLogin() {
  return (
    <div className="min-h-screen scenic-bg text-white flex items-center justify-center p-6">
      <div className="w-full max-w-3xl grid md:grid-cols-2 gap-6">
        <Link to="/login/server" className="glass-card p-8 rounded-2xl hover:scale-[1.01] transition">
          <h2 className="text-2xl font-semibold mb-2">Server Admin</h2>
          <p className="text-white/80">Platform owner login. Create schools and provision school admins.</p>
        </Link>
        <Link to="/login/school" className="glass-card p-8 rounded-2xl hover:scale-[1.01] transition">
          <h2 className="text-2xl font-semibold mb-2">School Management</h2>
          <p className="text-white/80">School admin login to approve or reject students.</p>
        </Link>
      </div>
    </div>
  );
}
