import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

function classNames(...xs){
  return xs.filter(Boolean).join(' ');
}

export default function NewPostFlow({ open, onClose, onPosted }) {
  const [step, setStep] = useState('media'); // media | camera | edit | details
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [album, setAlbum] = useState('Recents');
  const [files, setFiles] = useState([]); // [{file, url, kind}]
  const [editingIndex, setEditingIndex] = useState(0);
  const [filters, setFilters] = useState({ brightness: 100, contrast: 100 });
  const [overlayText, setOverlayText] = useState('');
  const [caption, setCaption] = useState('');
  const [allowCollab, setAllowCollab] = useState(true);
  const [shareDisabled, setShareDisabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    // Disable/enable share button based on validity
    if (step === 'details') {
      const mediaOk = files.length > 0;
      const textOk = caption.trim().length > 0;
      setShareDisabled(!(mediaOk || textOk));
    }
  }, [step, files.length, caption]);

  useEffect(() => {
    if (!open) {
      // reset on close
      setStep('media');
      setAllowMultiple(true);
      setAlbum('Recents');
      setFiles([]);
      setEditingIndex(0);
      setFilters({ brightness: 100, contrast: 100 });
      setOverlayText('');
      setCaption('');
      setAllowCollab(true);
      setShareDisabled(true);
      setUploading(false);
      setTextOnly(false);
    }
  }, [open]);

  const onSelectFiles = (list) => {
    const arr = Array.from(list || []);
    const mapped = arr.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      kind: f.type.startsWith('video/') ? 'video' : 'image',
    }));
    setFiles((prev) => (allowMultiple ? [...prev, ...mapped] : mapped.slice(0,1)));
  };

  async function openCamera() {
    setStep('camera');
  }

  function removeAt(i){
    setFiles(prev => prev.filter((_,idx)=> idx !== i));
    if (editingIndex >= i && editingIndex > 0) setEditingIndex(editingIndex-1);
  }

  function gotoEdit(){
    if (textOnly) { setStep('details'); return; }
    if (files.length === 0) return;
    setStep('edit');
  }

  function gotoDetails(){
    setStep('details');
  }

  async function doShare(){
    if (shareDisabled || uploading) return;
    try {
      setUploading(true);
      const headers = { Authorization: `Bearer ${token}` };

      let media = [];
      // Upload each file if any
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f.file);
        const up = await API.post('/posts/upload', fd, { headers, onUploadProgress: ()=>{} });
        if (up.data?.media) media.push(up.data.media);
      }
      // hashtags from caption
      const hashtags = (caption.match(/#\w+/g) || []).map(h=>h.toLowerCase());
      const body = { media, caption, hashtags, visibility: 'school' };
      const r = await API.post('/posts', body, { headers });
      if (r.status === 201) {
        onPosted?.(r.data.post);
        onClose?.();
      }
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || 'Failed to share');
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900" aria-label="Close">✕</button>
          <div className="font-semibold">
            {step === 'media' && 'New Post'}
            {step === 'camera' && 'Camera'}
            {step === 'edit' && 'Edit Post'}
            {step === 'details' && 'Post Details'}
          </div>
          {step === 'media' && (
            <button
              disabled={files.length === 0 && !textOnly}
              onClick={gotoEdit}
              className={classNames('px-3 py-1.5 rounded', files.length===0 && !textOnly ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white')}
            >Next →</button>
          )}
          {step === 'edit' && (
            <button onClick={gotoDetails} className="px-3 py-1.5 rounded bg-indigo-600 text-white">Next →</button>
          )}
          {step === 'camera' && <div className="w-16" />}
          {step === 'details' && (
            <button
              disabled={shareDisabled || uploading}
              onClick={doShare}
              className={classNames('px-3 py-1.5 rounded', shareDisabled || uploading ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white')}
            >{uploading ? 'Sharing…' : 'Share'}</button>
          )}
        </div>

        {/* Body */}
        {step === 'media' && (
          <MediaPicker
            album={album}
            setAlbum={setAlbum}
            allowMultiple={allowMultiple}
            setAllowMultiple={setAllowMultiple}
            files={files}
            onSelectFiles={onSelectFiles}
            onOpenCamera={openCamera}
            onRemove={removeAt}
            textOnly={textOnly}
            setTextOnly={setTextOnly}
          />
        )}

        {step === 'camera' && (
          <CameraCapture
            onCancel={()=>setStep('media')}
            onUse={(blob, kind)=>{
              const f = new File([blob], kind==='video'?'capture.mp4':'capture.jpg', { type: blob.type || (kind==='video'?'video/mp4':'image/jpeg') });
              const obj = { file: f, url: URL.createObjectURL(f), kind };
              setFiles(prev => allowMultiple ? [...prev, obj] : [obj]);
              setStep('edit');
            }}
          />
        )}

        {step === 'edit' && (
          <EditPreview
            files={files}
            index={editingIndex}
            setIndex={setEditingIndex}
            filters={filters}
            setFilters={setFilters}
            overlayText={overlayText}
            setOverlayText={setOverlayText}
          />
        )}

        {step === 'details' && (
          <PostDetails
            files={files}
            caption={caption}
            setCaption={setCaption}
            allowCollab={allowCollab}
            setAllowCollab={setAllowCollab}
          />
        )}
      </div>
    </div>
  );
}

function MediaPicker({ album, setAlbum, allowMultiple, setAllowMultiple, files, onSelectFiles, onOpenCamera, onRemove, textOnly, setTextOnly }){
  const inputRef = useRef(null);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="font-medium">{album} ▼</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-indigo-600" checked={allowMultiple} onChange={e=>setAllowMultiple(e.target.checked)} />
            Select Multiple
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-indigo-600" checked={textOnly} onChange={e=>setTextOnly(e.target.checked)} />
            Text-only post
          </label>
        </div>
      </div>

      {/* Selected previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((m, idx)=>(
            <div key={idx} className="relative w-24 h-24 overflow-hidden rounded-lg border">
              {m.kind === 'video' ? (
                <video src={m.url} className="w-full h-full object-cover" />
              ) : (
                <img src={m.url} className="w-full h-full object-cover" />
              )}
              <button onClick={()=>onRemove(idx)} className="absolute top-1 right-1 bg-black/60 text-white rounded px-1">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-xl p-4">
        <div className="text-sm text-gray-600 mb-2">Pick from your device</div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple={allowMultiple} hidden onChange={e=>onSelectFiles(e.target.files)} />
        <button onClick={()=>inputRef.current?.click()} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">Choose files</button>
      </div>

      {/* Bottom bar */}
      <div className="mt-3 flex items-center justify-around border-t pt-3 text-sm">
        <button className="px-3 py-1.5 rounded bg-indigo-600 text-white">🖼️ Post</button>
        <button onClick={onOpenCamera} className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200">📷 Camera</button>
        <button disabled className="px-3 py-1.5 rounded bg-gray-100 text-gray-400">📹 Reel</button>
      </div>
    </div>
  );
}

function CameraCapture({ onCancel, onUse }){
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [rec, setRec] = useState(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        alert('Camera not available');
        onCancel?.();
      }
    })();
    return () => {
      stream?.getTracks?.().forEach(t=>t.stop());
    };
  }, []);

  function capturePhoto(){
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob)=>{
      if (blob) onUse(blob, 'image');
    }, 'image/jpeg', 0.9);
  }

  function startStopVideo(){
    if (!isVideo){
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e)=>{ if (e.data.size>0) chunksRef.current.push(e.data); };
      recorder.onstop = ()=>{
        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        onUse(blob, 'video');
      };
      recorder.start();
      setRec(recorder);
      setIsVideo(true);
    } else {
      rec?.stop();
      setIsVideo(false);
    }
  }

  return (
    <div className="p-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={onCancel} className="px-3 py-1.5 rounded bg-gray-100">Cancel</button>
        <div className="flex items-center gap-3">
          <button onClick={()=>setIsVideo(false)} className={classNames('px-3 py-1.5 rounded', !isVideo ? 'bg-indigo-600 text-white':'bg-gray-100')}>Photo</button>
          <button onClick={()=>setIsVideo(true)} className={classNames('px-3 py-1.5 rounded', isVideo ? 'bg-indigo-600 text-white':'bg-gray-100')}>Video</button>
        </div>
        {!isVideo ? (
          <button onClick={capturePhoto} className="px-5 py-2 rounded-full bg-indigo-600 text-white">Capture</button>
        ) : (
          <button onClick={startStopVideo} className="px-5 py-2 rounded-full bg-indigo-600 text-white">{rec? 'Stop' : 'Record'}</button>
        )}
      </div>
    </div>
  );
}

function EditPreview({ files, index, setIndex, filters, setFilters, overlayText, setOverlayText }){
  const current = files[index];
  const filterCss = `brightness(${filters.brightness}%) contrast(${filters.contrast}%)`;
  return (
    <div className="p-4 space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center" style={{ minHeight: 360 }}>
        {current?.kind === 'video' ? (
          <video src={current?.url} controls className="max-h-[70vh] w-full object-contain" style={{ filter: filterCss }} />
        ) : (
          <div className="relative">
            <img src={current?.url} className="max-h-[70vh] w-full object-contain" style={{ filter: filterCss }} />
            {overlayText && (
              <div className="absolute bottom-4 left-4 right-4 text-white text-xl font-semibold drop-shadow">{overlayText}</div>
            )}
          </div>
        )}
      </div>

      {/* thumbnails */}
      {files.length > 1 && (
        <div className="flex gap-2 overflow-x-auto py-1">
          {files.map((m, i)=>(
            <button key={i} onClick={()=>setIndex(i)} className={classNames('w-16 h-16 rounded border overflow-hidden', index===i ? 'ring-2 ring-indigo-500':'') }>
              {m.kind==='video'?<video src={m.url} className="w-full h-full object-cover" />:<img src={m.url} className="w-full h-full object-cover" />}
            </button>
          ))}
        </div>
      )}

      {/* toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-sm">
        <button className="px-3 py-2 rounded bg-gray-100" title="Add Audio" disabled>🎵 Audio</button>
        <button className="px-3 py-2 rounded bg-gray-100" title="Overlay Text" onClick={()=>setOverlayText(prompt('Enter overlay text')||'')}>Aa Text</button>
        <button className="px-3 py-2 rounded bg-gray-100" title="Overlay Sticker" disabled>🖼️ Overlay</button>
        <button className="px-3 py-2 rounded bg-gray-100" title="Filters (basic)">✨ Filter</button>
        <div className="px-3 py-2 rounded bg-gray-100 flex items-center gap-2" title="Brightness/Contrast">
          <span>⚙️</span>
          <input type="range" min="50" max="150" value={filters.brightness} onChange={e=>setFilters(prev=>({ ...prev, brightness: Number(e.target.value) }))} />
          <input type="range" min="50" max="150" value={filters.contrast} onChange={e=>setFilters(prev=>({ ...prev, contrast: Number(e.target.value) }))} />
        </div>
      </div>
    </div>
  );
}

function PostDetails({ files, caption, setCaption, allowCollab, setAllowCollab }){
  const media = files[0];
  return (
    <div className="p-4 space-y-3">
      {media && (
        <div className="rounded-lg overflow-hidden border">
          {media.kind==='video' ? (
            <video src={media.url} controls className="w-full max-h-[40vh] object-contain bg-black" />
          ) : (
            <img src={media.url} className="w-full max-h-[40vh] object-contain bg-black/5" />
          )}
        </div>
      )}

      <textarea
        rows={4}
        className="w-full border rounded-lg px-3 py-2"
        placeholder="Add a caption…"
        value={caption}
        onChange={e=>setCaption(e.target.value)}
      />

      {/* Optional fields */}
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="border rounded px-3 py-2" placeholder="🎵 Add Music (optional)" disabled />
        <input className="border rounded px-3 py-2" placeholder="👥 Tag Classmates (optional)" disabled />
        <input className="border rounded px-3 py-2" placeholder="📍 Add Location (optional)" disabled />
        <input className="border rounded px-3 py-2" placeholder="🏷️ Project / Event Title (optional)" />
        <input className="border rounded px-3 py-2" placeholder="🔖 AI Label / Category (optional)" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-indigo-600" checked={allowCollab} onChange={e=>setAllowCollab(e.target.checked)} />
        🤝 Allow Collaboration Requests
      </label>
    </div>
  );
}
