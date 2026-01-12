export function academicYearFromStart(startYear){
  if(!Number.isFinite(Number(startYear))) return undefined;
  const yy = String(startYear).slice(-2);
  const next = String(startYear+1).slice(-2);
  return `${yy}${next}`; // compact 2425
}

export function formatAcademicLabel(startYear){
  const y1 = String(startYear).slice(-2);
  const y2 = String(startYear+1).slice(-2);
  return `${startYear}-${String(startYear+1).slice(-2)}`; // 2024-25
}

export function classCodeFor(level){
  if(level==='LKG' || level==='UKG') return level;
  const n = Number(level);
  if(Number.isFinite(n)) return String(n).padStart(2,'0');
  // try extract digits
  const m = String(level||'').match(/\d{1,2}/);
  if(m) return String(Number(m[0])).padStart(2,'0');
  return String(level||'').toUpperCase();
}

// Deterministic roll number generator; sequence provided by caller
export function buildRoll(prefix, startYear, level, seq){
  const yr = academicYearFromStart(Number(startYear));
  const cls = classCodeFor(level);
  return `${prefix}-${yr}-${cls}-${String(seq).padStart(3,'0')}`;
}
