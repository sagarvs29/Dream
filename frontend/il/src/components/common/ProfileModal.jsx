import React from 'react';

/**
 * Reusable profile modal.
 * Props:
 *  - open: boolean controls visibility
 *  - onClose: function to close
 *  - title: heading text (e.g. "Mentor Profile")
 *  - avatarInitials: short string for circle avatar
 *  - sections: array of { title?: string, fields: [{ label: string, value: React.ReactNode, isLink?: boolean }] }
 */
export default function ProfileModal({ open, onClose, title, avatarInitials, sections = [] }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-medium text-slate-800">{title}</div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700" aria-label="Close profile modal">✕</button>
        </div>
        <div className="p-4 text-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-semibold" aria-hidden="true">{(avatarInitials||'?').slice(0,2).toUpperCase()}</div>
            <div>
              {/* First non-empty line among fields labeled Name, User, Organization, etc. */}
            </div>
          </div>
          {sections.map((sec, idx) => (
            <div key={idx} className="mb-4">
              {sec.title && <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{sec.title}</div>}
              <div className="space-y-1.5 text-sm">
                {sec.fields.filter(f => f.value).map((f, i) => (
                  <div key={i} className="flex">
                    <span className="text-slate-500 min-w-[90px]">{f.label}:</span>
                    <span className="text-slate-700 break-words">
                      {f.isLink ? <a href={String(f.value)} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{f.value}</a> : f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
