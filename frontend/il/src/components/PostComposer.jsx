import React, { useRef, useState } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
});

// Visibility values mapping for UI -> backend
// UI options: public, friends, private
// Backend currently supports: public, school
// We'll map friends/private -> school for now, and show accurate labels in UI.
const mapVisibilityToBackend = (v) => (v === "public" ? "public" : "school");

export default function PostComposer({ user, onPostCreated }) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("friends"); // public | friends | private
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const openPhotoPicker = () => photoInputRef.current?.click();
  const openVideoPicker = () => videoInputRef.current?.click();

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) {
      alert("Please select an image or video file");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      alert("File is too large (max 20MB)");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result || ""));
    reader.readAsDataURL(f);
  }

  async function handlePost() {
    if (!file) {
      alert("Please upload a photo or video");
      return;
    }
    try {
      setUploading(true);
      const token = localStorage.getItem("token");
      if (!token) return alert("Login required");

      // 1) Upload media to server -> Cloudinary
      const fd = new FormData();
      fd.append("file", file);
      const up = await API.post("/posts/upload", fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const media = [up.data.media];

      // 2) Create post with caption + mapped visibility
      const hashtags = (caption.match(/#\w+/g) || []).map((h) => h.toLowerCase());
      const vis = mapVisibilityToBackend(visibility);
      const r = await API.post(
        "/posts",
        { media, caption, hashtags, visibility: vis },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.status === 201) {
        setCaption("");
        setVisibility("friends");
        setFile(null);
        setPreviewUrl("");
        onPostCreated?.(r.data.post);
      }
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Failed to post");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border shadow-sm bg-white/95 backdrop-blur p-4">
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
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What’s on your mind?"
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 placeholder:text-gray-400"
          />

          {/* Media preview */}
          {previewUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border bg-black/5">
              {file?.type?.startsWith("video/") ? (
                <video controls className="w-full max-h-[55vh] object-contain">
                  <source src={previewUrl} />
                </video>
              ) : (
                <img src={previewUrl} alt="preview" className="w-full max-h-[55vh] object-contain" />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openPhotoPicker}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 shadow-sm"
            >
              📷 <span className="hidden sm:inline">Photo</span>
            </button>
            <button
              type="button"
              onClick={openVideoPicker}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 shadow-sm"
            >
              🎬 <span className="hidden sm:inline">Video</span>
            </button>

            {/* Hidden inputs */}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={onFileChange} />

            {/* Visibility */}
            <div className="ml-auto inline-flex items-center gap-2">
              <label className="text-sm text-gray-600">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
              >
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Private</option>
              </select>
            </div>

            <button
              type="button"
              disabled={uploading}
              onClick={handlePost}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
