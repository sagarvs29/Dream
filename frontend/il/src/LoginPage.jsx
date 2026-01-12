import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/signup");
  };
  const [formData, setFormData] = useState({
    identifier: "", // phone or email
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "identifier") {
      // allow email or digits-only phone; don't block user from typing '@' etc.
      const v = value.replace(/\s+/g, "");
      setFormData({ ...formData, identifier: v });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
  const res = await axios.post("http://localhost:5000/api/auth/student/login", formData);
      const { status, token, message } = res.data || {};
      if (status === "Approved" && token) {
        localStorage.setItem("token", token);
        alert("Login successful");
        navigate("/home");
      } else if (status === "Pending") {
        alert(message || "Your signup is pending school approval.");
      } else if (status === "Rejected") {
        alert(message || "Your signup was rejected by school.");
      } else {
        alert(message || "Login response not recognized");
      }
    } catch (err) {
      console.error("Login error:", err.response?.data || err.message);
      alert("Error logging in: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600">
      {/* Back button */}
      <button
        onClick={goBack}
        aria-label="Go back"
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-full bg-white/90 text-slate-700 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Welcome Back
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Login to continue to your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            name="identifier"
            placeholder="Phone (10 digits) or Email"
            value={formData.identifier}
            onChange={handleChange}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
          />

          <input
            type="password"
            name="password"
            placeholder="Enter Password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-400"
          />

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition duration-300"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-gray-600">
          <p>
            Don’t have an account?{" "}
            <a href="/signup" className="text-indigo-500 font-semibold hover:underline">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
