import React from "react";
import { Link } from "react-router-dom";

export default function HomePortal() {
  return (
    <div className="min-h-screen scenic-bg text-white">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-indigo-700 font-bold">IAb</div>
          <span className="text-white/90 text-lg">mlnds</span>
        </div>
        <div className="flex-1 max-w-2xl mx-6">
          <div className="glass-nav flex items-center gap-2 px-4 py-2 rounded-full">
            <span>🔍</span>
            <input className="flex-1 bg-transparent outline-none text-white/90 placeholder-white/70" placeholder="Search students, schools, topics..." />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/mentor/login" className="glass-nav px-3 py-2 rounded-full hover:bg-white/20">Mentor Login</a>
          <div className="glass-nav px-3 py-2 rounded-full">👤</div>
        </div>
      </header>

      {/* Post Box */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="glass-card p-4 rounded-2xl">
          <input className="w-full bg-white text-gray-800 px-4 py-3 rounded-full outline-none" placeholder="Share your innovation, talent, or brilliant idea..." />
          <div className="flex gap-3 mt-3">
            <button className="glass-nav px-3 py-2">🎥 Talent Video</button>
            <button className="glass-nav px-3 py-2">💡 Innovation</button>
            <button className="glass-nav px-3 py-2">🏆 Achievement</button>
            <button className="glass-nav px-3 py-2">👤 Project</button>
          </div>
        </div>
      </section>

      {/* Trending Section */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <h2 className="text-white/90 mb-3">🔥 Trending in IAb mlnds</h2>
        <div className="grid gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="glass-card p-4 rounded-2xl hover:scale-[1.01] transition-transform">
              <div className="flex gap-3 items-start">
                <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">🚀</div>
                <div>
                  <div className="font-semibold">ISRO Student Challenge 2025</div>
                  <div className="text-white/80">Design next-gen satellites for Karnataka's space program</div>
                  <div className="mt-2 glass-nav inline-block px-3 py-1 text-sm">2.3K students participating</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-10" />
    </div>
  );
}
