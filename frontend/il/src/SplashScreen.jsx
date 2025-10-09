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
    <div className="h-screen w-screen relative overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
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
          {/* White card for structure */}
          <div className="bg-white/95 p-6 rounded-3xl shadow-2xl flex items-center justify-center animate-fadeInOut">
            {/* inner circle accent (brown/cream) */}
            <div
              className="rounded-full p-4 flex items-center justify-center"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(255,238,220,1), rgba(245,200,150,0.9))",
                boxShadow: "inset 0 3px 8px rgba(0,0,0,0.06)",
              }}
            >
              {/* logo image */}
              <img
                src="/logo.png"
                alt="App Logo"
                className="w-28 h-28 object-contain"
                style={{ display: "block" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
