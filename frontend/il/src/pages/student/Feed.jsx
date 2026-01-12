import React, { useMemo, useState } from "react";

// Dummy feed data
const DUMMY_POSTS = [
  {
    id: "p1",
    user: { name: "Aarav Sharma", school: "Greenfield Public School", avatar: "https://i.pravatar.cc/100?img=12" },
    image: "https://images.unsplash.com/photo-1601933470928-c1b6ce5e61b5?q=80&w=1200&auto=format&fit=crop",
    caption: "Built my first line-following robot using Arduino!",
    likes: 128,
    comments: 14,
    saved: false,
    tag: "innovation",
  },
  {
    id: "p2",
    user: { name: "Priya Verma", school: "Lotus Valley High", avatar: "https://i.pravatar.cc/100?img=32" },
    image: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop",
    caption: "Showcasing my talent video: piano mashup of favorite themes.",
    likes: 342,
    comments: 58,
    saved: true,
    tag: "talent",
  },
  {
    id: "p3",
    user: { name: "Rahul Mehta", school: "Springdale School", avatar: "https://i.pravatar.cc/100?img=44" },
    image: "https://images.unsplash.com/photo-1556514767-5c270b96a005?q=80&w=1200&auto=format&fit=crop",
    caption: "Won the district-level science fair with our solar purifier!",
    likes: 210,
    comments: 26,
    saved: false,
    tag: "achievement",
  },
  {
    id: "p4",
    user: { name: "Neha Gupta", school: "Blue Ridge Academy", avatar: "https://i.pravatar.cc/100?img=5" },
    image: "https://images.unsplash.com/photo-1549921296-3ecf9f30c05a?q=80&w=1200&auto=format&fit=crop",
    caption: "Project sneak peek: an app to manage school clubs and events.",
    likes: 89,
    comments: 10,
    saved: false,
    tag: "project",
  },
];

const FILTERS = [
  { key: "talent", label: "Talent Video" },
  { key: "innovation", label: "Innovation" },
  { key: "achievement", label: "Achievement" },
  { key: "project", label: "Project" },
];

export default function Feed() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(null);
  const [feed, setFeed] = useState(DUMMY_POSTS);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.filter((p) => {
      const matchTag = activeFilter ? p.tag === activeFilter : true;
      const matchQuery = !q
        ? true
        : p.caption.toLowerCase().includes(q) ||
          p.user.name.toLowerCase().includes(q) ||
          p.user.school.toLowerCase().includes(q) ||
          (q.startsWith("#") ? ("#" + p.tag).includes(q) : p.tag.includes(q));
      return matchTag && matchQuery;
    });
  }, [feed, query, activeFilter]);

  function toggleLike(id) {
    setFeed((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
  }

  function toggleSave(id) {
    setFeed((prev) => prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-4">
        {/* header search */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-md focus-within:ring-2 ring-purple-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5 text-gray-500"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by hashtags… e.g. #innovation #project"
              className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 py-1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter((cur) => (cur === f.key ? null : f.key))}
                className={
                  "px-3 py-1.5 rounded-full text-sm transition border " +
                  (activeFilter === f.key
                    ? "bg-purple-600 text-white border-purple-500 shadow-[0_6px_18px_rgba(138,43,226,0.45)]"
                    : "bg-white/80 text-gray-700 border-gray-200 hover:bg-white")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* feed list */}
        <div className="mt-5 grid grid-cols-1 gap-5">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="group rounded-2xl bg-white shadow hover:shadow-xl transition duration-200 border border-white/0 overflow-hidden hover:-translate-y-0.5"
            >
              {/* user header */}
              <header className="flex items-center gap-3 px-4 pt-4">
                <img src={p.user.avatar} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 leading-tight">{p.user.name}</div>
                  <div className="text-sm text-gray-500 leading-tight truncate">{p.user.school}</div>
                </div>
              </header>
              {/* image */}
              <div className="mt-3">
                <img src={p.image} alt="post" className="w-full h-[280px] object-cover" />
              </div>
              {/* caption */}
              <p className="px-4 mt-3 text-gray-800">{p.caption}</p>
              {/* footer */}
              <footer className="px-4 py-3">
                <div className="flex items-center gap-5">
                  <button
                    className="flex items-center gap-1.5 text-gray-600 hover:text-purple-600 transition"
                    onClick={() => toggleLike(p.id)}
                    aria-label="Like"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="text-sm">{p.likes}</span>
                  </button>

                  <button className="flex items-center gap-1.5 text-gray-600 hover:text-purple-600 transition" aria-label="Comment">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm">{p.comments}</span>
                  </button>

                  <button
                    className={"ml-auto flex items-center gap-1.5 transition " + (p.saved ? "text-purple-600" : "text-gray-600 hover:text-purple-600")}
                    aria-label="Save"
                    onClick={() => toggleSave(p.id)}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                    </svg>
                    <span className="text-sm">{p.saved ? "Saved" : "Save"}</span>
                  </button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
  );
}
