// Lightweight command parser for Institution Copilot
// Returns { intent, slots, confirmationRequired, errors }

const patterns = [
  {
    intent: "UPDATE_TIMETABLE",
    regex: /update\s+(?<classCode>\w+)\s+timetable.*?(?<subject>[A-Za-z]+).*room\s+(?<room>\w+)/i,
    slots: ["classCode","subject","room"],
    confirm: true,
  },
  {
    intent: "PUBLISH_REPORTCARDS",
    regex: /publish\s+(all\s+)?(?<termId>Q\d|TERM\d)\s+report\s+cards\s+for\s+(class\s+)?(?<classCode>\w+)/i,
    slots: ["termId","classCode"],
    confirm: true,
  },
  {
    intent: "MARK_ATTENDANCE",
    regex: /mark\s+attendance\s+for\s+(?<classCode>\w+)/i,
    slots: ["classCode"],
    confirm: false,
  },
  {
    intent: "ANNOUNCEMENT_DRAFT",
    regex: /draft\s+(an?\s+)?announcement\s+about\s+(?<topic>.+)/i,
    slots: ["topic"],
    confirm: false,
  },
  {
    intent: "ANNOUNCEMENT_PUBLISH",
    regex: /publish\s+(the\s+)?announcement/i,
    slots: [],
    confirm: true,
  },
  {
    intent: "ATTENDANCE_LOW_PERFORMERS",
    regex: /students\s+below\s+(?<percentage>\d+)%\s+attendance/i,
    slots: ["percentage"],
    confirm: false,
  },
];

export function parseCommand(text) {
  text = text.trim();
  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m) {
      const slots = {};
      for (const s of p.slots) {
        slots[s] = m.groups?.[s];
      }
      return { intent: p.intent, slots, confirmationRequired: p.confirm, errors: [] };
    }
  }
  return { intent: null, slots: {}, confirmationRequired: false, errors: ["Unable to interpret command"] };
}

export function requiredSlots(intent) {
  switch (intent) {
    case "UPDATE_TIMETABLE": return ["classCode","subject","room"];
    case "PUBLISH_REPORTCARDS": return ["termId","classCode"];
    case "MARK_ATTENDANCE": return ["classCode"]; 
    case "ANNOUNCEMENT_DRAFT": return ["topic"]; 
    case "ATTENDANCE_LOW_PERFORMERS": return ["percentage"]; 
    default: return []; 
  }
}

export function confirmationPrompt(intent, slots) {
  switch (intent) {
    case "PUBLISH_REPORTCARDS":
      return `Confirm: Publish ${slots.termId} Report Cards for ${slots.classCode} now?`;
    case "UPDATE_TIMETABLE":
      return `Confirm: Apply timetable change for ${slots.classCode} (${slots.subject} -> room ${slots.room})?`;
    case "ANNOUNCEMENT_PUBLISH":
      return "Confirm: Publish the drafted announcement now?";
    default:
      return null;
  }
}
