import React, { useState } from 'react';
import { useInstitutionCopilotState } from './useInstitutionCopilotState';

export default function InstitutionCopilotPanel() {
  const { messages, pending, handleUserInput, confirmAction, context } = useInstitutionCopilotState();
  const [input, setInput] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    handleUserInput(input);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-purple-400/40 flex items-center justify-between bg-purple-900/30 backdrop-blur">
        <h2 className="font-semibold text-sm text-white">Institution Copilot</h2>
        {pending && <div className="text-xs text-purple-200 animate-pulse">Working…</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2" aria-live="polite">
        {messages.map((m,i) => (
          <div key={i} className={`text-xs rounded px-2 py-1 ${m.role==='user'?'bg-purple-600/40 text-white self-end':'bg-purple-950/40 text-purple-100'}`}>{m.text}</div>
        ))}
        {context.awaitingConfirmation && (
          <div className="bg-yellow-600/30 border border-yellow-400/40 rounded p-2 text-xs text-yellow-100">
            Awaiting confirmation.
            <div className="mt-2 flex gap-2">
              <button onClick={confirmAction} className="px-2 py-1 rounded bg-green-600/70 text-white text-xs">Confirm</button>
              <button onClick={() => { /* cancel */ }} className="px-2 py-1 rounded bg-red-600/70 text-white text-xs">Cancel</button>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="p-3 border-t border-purple-400/30 bg-purple-900/40 backdrop-blur flex gap-2">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Type a command (e.g., Publish all Q2 report cards for Class 7)"
          className="flex-1 text-xs px-2 py-2 rounded bg-purple-950/50 border border-purple-500/50 text-white"
        />
        <button type="submit" className="text-xs px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white">Send</button>
      </form>
    </div>
  );
}
