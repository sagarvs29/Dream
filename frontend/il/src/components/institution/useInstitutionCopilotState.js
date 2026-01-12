import { useState } from "react";
import { parseCommand, requiredSlots, confirmationPrompt } from "./commandParser";
import { api } from "./institutionApi";

export function useInstitutionCopilotState() {
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant'|'system', text }
  const [pending, setPending] = useState(false);
  const [context, setContext] = useState({ currentIntent: null, slots: {}, awaitingConfirmation: false });

  function push(role, text) { setMessages(m => [...m, { role, text }]); }

  async function handleUserInput(raw) {
    push('user', raw);
    const parsed = parseCommand(raw);
    if (!parsed.intent) { push('assistant', parsed.errors[0]); return; }

    // Fill slots
    const missing = requiredSlots(parsed.intent).filter(s => !parsed.slots[s]);
    if (missing.length) {
      setContext({ currentIntent: parsed.intent, slots: parsed.slots, awaitingConfirmation: false });
      push('assistant', `Please provide: ${missing.join(', ')}`);
      return;
    }

    // Ask for confirmation if needed
    if (parsed.confirmationRequired) {
      setContext({ currentIntent: parsed.intent, slots: parsed.slots, awaitingConfirmation: true });
      const prompt = confirmationPrompt(parsed.intent, parsed.slots);
      push('assistant', prompt);
      return;
    }

    await executeIntent(parsed.intent, parsed.slots);
  }

  async function confirmAction() {
    if (!context.awaitingConfirmation) return;
    await executeIntent(context.currentIntent, context.slots);
  }

  async function executeIntent(intent, slots) {
    setPending(true);
    try {
      switch (intent) {
        case 'MARK_ATTENDANCE': {
          const today = new Date().toISOString().slice(0,10);
          const resp = await api.markAttendance(slots.classCode, today, []); // Empty initial list, UI can follow-up
          push('assistant', `Attendance session started for ${slots.classCode}. Add records.`);
          break;
        }
        case 'PUBLISH_REPORTCARDS': {
          const resp = await api.publishReportCards(slots.termId, slots.classCode);
          push('assistant', `Published ${resp.publishedCount} report cards for ${slots.termId}.`);
          break;
        }
        case 'UPDATE_TIMETABLE': {
          push('assistant', 'Timetable update intent captured. (UI for specifics forthcoming)');
          break;
        }
        case 'ANNOUNCEMENT_DRAFT': {
          push('assistant', `Draft stored for announcement topic: ${slots.topic}. Provide content to finalize.`);
          break;
        }
        case 'ANNOUNCEMENT_PUBLISH': {
          push('assistant', 'Publishing announcement… (Connect to API once draft ID known)');
          break;
        }
        case 'ATTENDANCE_LOW_PERFORMERS': {
          push('assistant', `Generating attendance report for students below ${slots.percentage}%…`);
          break;
        }
        default:
          push('assistant', 'Intent execution placeholder.');
      }
    } catch (e) {
      push('assistant', `Error: ${e.message}`);
    } finally {
      setPending(false);
      setContext({ currentIntent: null, slots: {}, awaitingConfirmation: false });
    }
  }

  return { messages, pending, context, handleUserInput, confirmAction };
}
