import React from "react";

export default function PostCard({ post, onLike, onComments, onShare, onMenu, isOwner }) {
  const a = post?.author || {};
  const likeCount = post?.likeCount ?? 0;
  const media = Array.isArray(post?.media) && post.media[0] ? post.media[0] : null;
  const isVideo = media && (media.kind === "video" || /\.mp4($|\?)/i.test(String(media.url || media.thumbUrl || "")));
  const mediaUrl = media?.url || media?.thumbUrl;

  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm hover:shadow-md transition dark:border-slate-700 dark:bg-slate-900/85">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {a.avatar || a.profilePictureUrl ? (
            <img src={a.avatar || a.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{a.name || "Student"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {typeof a.school === "object" ? a.school?.name : a.school || ""}
            </div>
          </div>
        </div>
        {isOwner && (
          <button
            aria-label="More options"
            className="h-9 w-9 grid place-items-center rounded-lg border border-slate-200/70 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onMenu}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
        )}
      </div>

      {/* Media */}
      {mediaUrl && (
        <div className="w-full aspect-[16/9] overflow-hidden">
          {isVideo ? (
            <video controls className="w-full h-full object-cover bg-black">
              <source src={mediaUrl} />
            </video>
          ) : (
            <img src={mediaUrl} alt="post media" className="w-full h-full object-cover" />
          )}
        </div>
      )}

      {/* Body */}
      {post?.caption && (
        <div className="px-4 py-3 text-slate-800 dark:text-slate-200 text-sm">{post.caption}</div>
      )}

      {/* Actions */}
      <div className="px-4 py-2 border-t border-slate-200/70 dark:border-slate-700 flex items-center gap-5 text-slate-600 dark:text-slate-300">
        <button onClick={onLike} className="hover:text-violet-600 dark:hover:text-violet-400 transition" aria-label="Like">❤ {likeCount}</button>
        <button onClick={onComments} className="hover:text-violet-600 dark:hover:text-violet-400 transition" aria-label="Comments">💬</button>
        <button onClick={onShare} className="hover:text-violet-600 dark:hover:text-violet-400 transition" aria-label="Share">🔗</button>
        <button className="ml-auto hover:text-violet-600 dark:hover:text-violet-400 transition" aria-label="Save">🔖</button>
      </div>
    </article>
  );
}
