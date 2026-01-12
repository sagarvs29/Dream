import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/apiClient";

// Visibility values mapping for UI -> backend
// UI options: public, friends, private
// Backend currently supports: public, school
// We'll map friends/private -> school for now, and show accurate labels in UI.
const mapVisibilityToBackend = (v) => (v === "public" ? "public" : "school");

// Simple CSS filter presets (client-side only)
const FILTERS = {
  normal: "none",
  clarendon: "contrast(1.2) saturate(1.2)",
  gingham: "contrast(1.1) hue-rotate(-10deg)",
  moon: "grayscale(1) contrast(1.1) brightness(1.1)",
  lark: "brightness(1.05) saturate(1.2)",
  juno: "contrast(1.15) saturate(1.3)",
};

// Light button style for white surfaces (ensures text visibility)
const BTN_LIGHT = "inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 shadow-sm";
const BTN_LIGHT_SM = "inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs shadow-sm";

export default function PostComposer({ user, onPostCreated }) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("friends"); // public | friends | private
  const [files, setFiles] = useState([]); // [{file, previewUrl, type, filter, aspect}]
  const [currentIdx, setCurrentIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState("pick"); // pick | edit | details
  const [hashtags, setHashtags] = useState([]); // explicit hashtags chips (strings without #)
  const [hashtagInput, setHashtagInput] = useState("");
  const [taggingOpen, setTaggingOpen] = useState(false);
  const [tagTab, setTagTab] = useState("mentors"); // mentors | friends
  const [mentors, setMentors] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]); // [{_id,name,userModel:'Teacher'|'Student'}]
  const [tagQuery, setTagQuery] = useState("");
  const [location, setLocation] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const openPhotoPicker = () => photoInputRef.current?.click();
  const openVideoPicker = () => videoInputRef.current?.click();

  function readAsDataURL(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function onFileChange(e) {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    const filtered = list.filter((f) => {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      return (isImage || isVideo) && f.size <= 20 * 1024 * 1024;
    });
    if (!filtered.length) return;
    const mapped = await Promise.all(filtered.map(async (f) => {
      const isVideo = f.type.startsWith("video/");
      const previewUrl = await readAsDataURL(f);
      return { file: f, previewUrl, type: isVideo ? "video" : "image", filter: "normal", aspect: "1:1" };
    }));
    setFiles((prev) => {
      const start = prev.length;
      const next = [...prev, ...mapped];
      setCurrentIdx(start);
      return next;
    });
    setStep("edit");
  }

  async function handlePost() {
    if (!files.length) { alert("Please upload a photo or video"); return; }
    try {
      setUploading(true);
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");

      // 1) Upload each media sequentially -> Cloudinary
      const uploaded = [];
      for (const item of files) {
        const fd = new FormData();
        fd.append("file", item.file);
        const up = await api.post("/posts/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
  uploaded.push({ ...up.data.media, filter: FILTERS[item.filter] || 'none', crop: { aspect: item.aspect } });
      }

      // 2) Create post with caption + mapped visibility + hashtags + tagged
      const extracted = (caption.match(/#\w+/g) || []).map((h) => h.replace(/^#/, "").toLowerCase());
      const manual = hashtags.map(h => String(h).toLowerCase());
      const allHashtags = Array.from(new Set([...extracted, ...manual]));
      const vis = mapVisibilityToBackend(visibility);
      const tagged = selectedTags.map(t => ({ userId: t._id, userModel: t.userModel }));
      const r = await api.post(
        "/posts",
        { media: uploaded, caption, hashtags: allHashtags, visibility: vis, tagged, location, musicTitle, musicArtist },
        {}
      );
      if (r.status === 201) {
        setCaption("");
        setVisibility("friends");
        setFiles([]);
        setCurrentIdx(0);
        setStep("pick");
        setHashtags([]);
        setSelectedTags([]);
        setLocation("");
        setMusicTitle("");
        setMusicArtist("");
        onPostCreated?.(r.data.post);
      }
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Failed to post");
    } finally {
      setUploading(false);
    }
  }

  // Load mentors/friends when tagging UI opens
  useEffect(() => {
    async function loadLists() {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const [m, s] = await Promise.all([
          api.get('/student/network/mentors'),
          api.get('/student/network/students'),
        ]);
        setMentors(m.data?.mentors || []);
        setFriends(s.data?.students || []);
      } catch (_) {}
    }
    if (taggingOpen && mentors.length === 0 && friends.length === 0) {
      loadLists();
    }
  }, [taggingOpen]);

  function addHashtagChipFromInput() {
    const raw = hashtagInput.trim();
    if (!raw) return;
    const tokens = raw.split(/[\s,]+/).map(t => t.replace(/^#/, '').toLowerCase()).filter(Boolean);
    if (!tokens.length) return;
    setHashtags(prev => Array.from(new Set([...(prev || []), ...tokens])));
    setHashtagInput("");
  }

  function toggleSelectTag(item, userModel) {
    const id = String(item._id);
    const exists = selectedTags.find(t => String(t._id) === id);
    if (exists) {
      setSelectedTags(prev => prev.filter(t => String(t._id) !== id));
    } else {
      setSelectedTags(prev => [...prev, { _id: item._id, name: item.name, userModel }]);
    }
  }

  const filteredMentors = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return mentors;
    return mentors.filter(m => String(m.name || '').toLowerCase().includes(q));
  }, [mentors, tagQuery]);
  const filteredFriends = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(s => String(s.name || '').toLowerCase().includes(q));
  }, [friends, tagQuery]);

  function moveItem(idx, dir) {
    setFiles(prev => {
      const copy = [...prev];
      const ni = idx + dir;
      if (ni < 0 || ni >= copy.length) return prev;
      const tmp = copy[idx];
      copy[idx] = copy[ni];
      copy[ni] = tmp;
      return copy;
    });
  }

  function renderPick() {
    return (
      <div>
        <div className="mb-3 text-gray-700 font-medium">Select media</div>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={openPhotoPicker} className={BTN_LIGHT}>Pick Photos</button>
          <button type="button" onClick={openVideoPicker} className={BTN_LIGHT}>Pick Videos</button>
        </div>
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto border rounded-lg p-2">
          {files.map((it, idx) => (
            <div key={idx} className={`relative rounded-md overflow-hidden border ${idx===currentIdx?'ring-2 ring-indigo-500':''}`} onClick={() => setCurrentIdx(idx)}>
              {it.type === 'video' ? (
                <video className="w-full h-full object-cover" src={it.previewUrl} muted />
              ) : (
                <img src={it.previewUrl} className="w-full h-full object-cover" />
              )}
              <div className="absolute right-1 top-1 flex gap-1">
                <button type="button" className={BTN_LIGHT_SM} onClick={(e)=>{e.stopPropagation(); moveItem(idx,-1);}}>↑</button>
                <button type="button" className={BTN_LIGHT_SM} onClick={(e)=>{e.stopPropagation(); moveItem(idx,1);}}>↓</button>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="col-span-3 text-sm text-gray-500">No files selected yet</div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className={BTN_LIGHT} disabled={!files.length} onClick={()=>setStep('edit')}>Next</button>
        </div>
      </div>
    );
  }

  function aspectToCss(a) {
    if (a === '4:5') return '4/5';
    if (a === '16:9') return '16/9';
    return '1/1';
  }

  function renderEdit() {
    const it = files[currentIdx];
    return (
      <div>
        <div className="mb-2 text-gray-700 font-medium">Edit</div>
        <div className="rounded-lg border overflow-hidden bg-black/5 flex items-center justify-center" style={{ aspectRatio: aspectToCss(it?.aspect) }}>
          {it ? (
            it.type === 'video' ? (
              <video controls className="h-full w-full object-contain" style={{ filter: FILTERS[it.filter] }} src={it.previewUrl} />
            ) : (
              <img src={it.previewUrl} className="h-full w-full object-contain" style={{ filter: FILTERS[it.filter] }} />
            )
          ) : (
            <div className="text-gray-500">No media</div>
          )}
        </div>
        <div className="mt-3">
          <div className="text-xs text-gray-600 mb-1">Filters</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(FILTERS).map((k) => (
              <button key={k} type="button" onClick={()=>{
                setFiles(prev => prev.map((x,i)=> i===currentIdx ? { ...x, filter: k } : x));
              }} className={`px-3 py-1.5 rounded-lg text-sm ${it?.filter===k? 'bg-indigo-100 text-indigo-700':'bg-gray-100'}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs text-gray-600 mb-1">Aspect</div>
          <div className="flex gap-2">
            {['1:1','4:5','16:9'].map(r => (
              <button key={r} type="button" onClick={()=>{
                setFiles(prev => prev.map((x,i)=> i===currentIdx ? { ...x, aspect: r } : x));
              }} className={`px-3 py-1.5 rounded-lg text-sm ${it?.aspect===r? 'bg-indigo-100 text-indigo-700':'bg-gray-100'}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" className={BTN_LIGHT} onClick={()=>setStep('pick')}>Back</button>
          <div className="flex items-center gap-2">
            <button type="button" className={BTN_LIGHT} onClick={()=>setCurrentIdx(Math.max(0,currentIdx-1))} disabled={currentIdx===0}>Prev</button>
            <button type="button" className={BTN_LIGHT} onClick={()=>{
              if (files.length <= 1 || currentIdx === files.length - 1) {
                setStep('details');
              } else {
                setCurrentIdx(Math.min(files.length-1,currentIdx+1));
              }
            }}>{(files.length <= 1 || currentIdx === files.length - 1) ? 'Next' : 'Next'}</button>
            <button type="button" className={BTN_LIGHT} onClick={()=>setStep('details')}>Continue</button>
          </div>
        </div>
      </div>
    );
  }

  function renderDetails() {
    return (
      <div>
        <div className="mb-3 text-gray-700 font-medium">New post</div>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="rounded-lg border overflow-hidden bg-black/5 aspect-square">
              {files[0]?.type === 'video' ? (
                <video className="w-full h-full object-contain" style={{ filter: FILTERS[files[0].filter] }} src={files[0].previewUrl} controls />
              ) : (
                <img className="w-full h-full object-contain" style={{ filter: FILTERS[files[0].filter] }} src={files[0]?.previewUrl} />
              )}
            </div>
            {files.length > 1 && (
              <div className="mt-2 grid grid-cols-5 gap-2">
                {files.slice(1).map((it, i) => (
                  <div key={i} className="rounded-md overflow-hidden border">
                    {it.type==='video' ? <video className="w-full h-full object-cover" src={it.previewUrl} /> : <img className="w-full h-full object-cover" src={it.previewUrl} />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption…"
              rows={5}
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 placeholder:text-gray-400"
            />

            {/* Hashtags */}
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-1">Hashtags</div>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                    #{h}
                    <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setHashtags(prev => prev.filter(x => x !== h))}>×</button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addHashtagChipFromInput(); } }}
                  placeholder="#art #science or comma/space separated"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button type="button" className={BTN_LIGHT} onClick={addHashtagChipFromInput}>Add</button>
              </div>
            </div>

            {/* Tag people */}
            <div className="mt-4">
              <button type="button" className={BTN_LIGHT} onClick={() => setTaggingOpen(v => !v)}>
                {taggingOpen ? 'Hide' : 'Tag people'}
              </button>
              {taggingOpen && (
                <div className="mt-2 rounded-xl border border-gray-200 p-3 bg-white/70">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" className={`px-3 py-1.5 text-sm rounded-lg ${tagTab==='mentors'?'bg-indigo-100 text-indigo-700':'bg-gray-100'}`} onClick={() => setTagTab('mentors')}>Mentors</button>
                      <button type="button" className={`px-3 py-1.5 text-sm rounded-lg ${tagTab==='friends'?'bg-indigo-100 text-indigo-700':'bg-gray-100'}`} onClick={() => setTagTab('friends')}>Friends</button>
                    </div>
                    <input value={tagQuery} onChange={(e)=>setTagQuery(e.target.value)} placeholder="Search" className="px-3 py-1.5 text-sm rounded-lg border border-gray-200" />
                  </div>
                  <div className="max-h-40 overflow-auto rounded-lg border border-gray-100 bg-white">
                    {(tagTab === 'mentors' ? filteredMentors : filteredFriends).map((p) => {
                      const checked = !!selectedTags.find(t => String(t._id) === String(p._id));
                      const userModel = tagTab === 'mentors' ? 'Teacher' : 'Student';
                      return (
                        <label key={p._id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 border-gray-100 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleSelectTag(p, userModel)} />
                          <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden">
                            {p.profilePictureUrl ? <img src={p.profilePictureUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">👤</div>}
                          </div>
                          <div className="text-sm text-gray-800">{p.name}</div>
                        </label>
                      );
                    })}
                    {((tagTab==='mentors' ? filteredMentors : filteredFriends).length === 0) && (
                      <div className="px-3 py-4 text-sm text-gray-500">No {tagTab} found</div>
                    )}
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTags.map(t => (
                        <span key={t._id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs">
                          {t.name}
                          <button type="button" className="hover:text-indigo-900" onClick={() => setSelectedTags(prev => prev.filter(x => String(x._id) !== String(t._id)))}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location & Music */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Add location</label>
                <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="City, school, venue…" className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Add music</label>
                <div className="mt-1 flex items-center gap-2">
                  <input value={musicTitle} onChange={(e)=>setMusicTitle(e.target.value)} placeholder="Title" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  <input value={musicArtist} onChange={(e)=>setMusicArtist(e.target.value)} placeholder="Artist" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            {/* Visibility + Post */}
            <div className="mt-4 flex items-center gap-3">
              <div className="inline-flex items-center gap-2">
                <label className="text-sm text-gray-600">Visibility</label>
                <select value={visibility} onChange={(e)=>setVisibility(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm">
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="ml-auto">
                <button type="button" className={BTN_LIGHT + ' mr-2'} onClick={()=>setStep('edit')}>Back</button>
                <button type="button" disabled={uploading} onClick={handlePost} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed">{uploading? 'Posting…' : 'Share'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border shadow-sm bg-white/95 backdrop-blur p-4" data-post-composer>
      <div className="flex items-start gap-3">
        {/* Profile picture */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px]">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
            {user?.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt="pfp" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">👤</div>
            )}
          </div>
        </div>

        {/* Compose area */}
        <div className="flex-1">
          {/* Hidden inputs for file picking (allow multiple) */}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" multiple onChange={onFileChange} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" multiple onChange={onFileChange} />

          {step === 'pick' && renderPick()}
          {step === 'edit' && renderEdit()}
          {step === 'details' && renderDetails()}
        </div>
      </div>
    </div>
  );
}
