export function audit(event, details = {}) {
  // TODO: persist to DB or external log sink
  // Keep PII out of logs; use tokens/ids
  console.log(`[AUDIT ${new Date().toISOString()}] ${event}`, details);
}
