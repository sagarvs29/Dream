// SplashScreen.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SplashScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [showLogo, setShowLogo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
      setShowLogo(true);
    }, 3000);

    const logoTimer = setTimeout(() => {
      setShowLogo(false);
      navigate("/signup");
    }, 6000);

    return () => {
      clearTimeout(splashTimer);
      clearTimeout(logoTimer);
    };
  }, [navigate]);

  return (
    <div className="scenic-bg h-screen w-screen relative overflow-hidden flex items-center justify-center">
      {/* Splash Video (behind) */}
      {showSplash && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <video
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover opacity-90"
          >
            <source src="/splash.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {/* Logo Block (center) */}
      {showLogo && (
        <div className="z-20 flex items-center justify-center">
          {/* Glass card wrapper for refined structure */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl shadow-2xl flex items-center justify-center animate-fadeInOut">
            {/* Soft inner panel */}
            <div className="bg-white/92 rounded-2xl p-4 sm:p-5 shadow-lg">
              {/* Brand-tinted halo behind logo */}
              <div
                className="rounded-full p-4 sm:p-5 flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(65% 65% at 35% 30%, rgba(255,238,220,1) 0%, rgba(245,200,150,0.9) 55%, rgba(240,185,120,0.85) 100%)",
                  boxShadow:
                    "inset 0 3px 8px rgba(0,0,0,0.08), 0 8px 28px rgba(0,0,0,0.18)",
                }}
              >
                {/* Logo image */}
                <img
                  src="/logo.png"
                  alt="App Logo"
                  className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                  style={{ display: "block" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
