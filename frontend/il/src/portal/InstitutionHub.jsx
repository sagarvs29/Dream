import React, { useEffect, useMemo, useState } from "react";
import ThemeProvider from "../components/ui/ThemeProvider";

const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";
// ------- Mentor Assessments (Quizzes) -------
function MentorAssessments({ token }) {
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title:"", description:"", timeLimitMinutes:0, totalPoints:0, questions:[] });
  const [teacher, setTeacher] = useState({ classes: [], subjects: [] });
  const [summary, setSummary] = useState(null);

  // Load teacher context to populate classes/subjects
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/institution/teacher/dashboard`, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null);
        const data = await res?.json?.().catch(()=>({})) || {};
        setTeacher({ classes: data?.assigned?.classes || [], subjects: data?.teacher?.subjects || [] });
      } catch {}
    })();
  }, [token]);

  // Auto-refresh list when filters change
  useEffect(() => {
    loadQuizzes();
  }, [cls, subject]);

  async function loadQuizzes(){
    try{
      if (!cls) { setList([]); return; }
      const usp = new URLSearchParams({ classCode: cls });
      if (subject) usp.set('subject', subject);
      const url = `${API}/institution/quizzes?${usp.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(()=>([]));
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); }
  }

  function addQuestion(type){
    setForm(s=>({ ...s, questions: [...(s.questions||[]), { type:type||'MCQ', text:'', options:["","","",""], correctAnswer:'', points:1 }] }));
  }
  function updateQuestion(i, field, value){
    setForm(s=>({ ...s, questions: (s.questions||[]).map((q,idx)=> idx===i ? { ...q, [field]: value } : q ) }));
  }
  function updateOption(i, j, value){
    setForm(s=>({ ...s, questions: (s.questions||[]).map((q,idx)=> idx===i ? { ...q, options: (q.options||[]).map((o,k)=> k===j? value : o) } : q ) }));
  }
  function removeQuestion(i){
    setForm(s=>({ ...s, questions: (s.questions||[]).filter((_,idx)=> idx!==i) }));
  }
  // Keep questions array in sync with the desired count
  function setQuestionCount(n){
    const count = Math.max(0, Number(n)||0);
    setForm(s=>{
      const prev = Array.isArray(s.questions) ? s.questions : [];
      let next = prev.slice(0, count);
      while (next.length < count) {
        next.push({ type:'MCQ', text:'', options:["","","",""], correctAnswer:'', points:1 });
      }
      return { ...s, totalQuestions: count, questions: next };
    });
  }

  async function submitQuiz(e){
    e.preventDefault();
    if (!cls || !subject) return;
    const desired = (typeof form.totalQuestions === 'number') ? form.totalQuestions : ((form.questions||[]).length||0);
    let qs = Array.isArray(form.questions) ? form.questions.slice(0, desired) : [];
    while (qs.length < desired) {
      qs.push({ type:'MCQ', text:'', options:["","","",""], correctAnswer:'', points:1 });
    }
    const totalPoints = qs.reduce((acc,q)=> acc + (Number(q.points)||0), 0);
    const payload = { subject, title: form.title, description: form.description, timeLimitMinutes: form.timeLimitMinutes, totalPoints, questions: qs };
    try{
      await fetch(`${API}/institution/quizzes/${encodeURIComponent(cls)}`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
      await loadQuizzes();
      setForm({ title:"", description:"", timeLimitMinutes:0, totalPoints:0, totalQuestions:0, questions:[] });
    } catch {}
  }

  async function publishQuiz(id){
    try{
      await fetch(`${API}/institution/quizzes/${id}/publish`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
      await loadQuizzes();
    } catch {}
  }

  async function openSummary(id){
    try{
      const res = await fetch(`${API}/institution/quizzes/${id}/summary`, { headers:{ Authorization:`Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setSummary(data); else alert(data?.message || 'Failed to load summary');
    } catch {}
  }

  async function closeQuiz(id){
    try{
      const res = await fetch(`${API}/institution/quizzes/${id}/close`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { alert(data?.message || 'Failed to close quiz'); return; }
      await loadQuizzes();
      // Refresh summary if it was open for this quiz
      if (summary?.quiz?._id === id) openSummary(id);
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div>
          <label className="text-sm">Class</label>
          <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={cls} onChange={e=>setCls(e.target.value)}>
            <option className="text-black" value="">Select</option>
            {(teacher.classes||[]).map((c,i)=> <option className="text-black" key={i} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">Subject</label>
          <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={subject} onChange={e=>setSubject(e.target.value)}>
            <option className="text-black" value="">All</option>
            {(teacher.subjects||[]).map((s,i)=> <option className="text-black" key={i} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={loadQuizzes} className="px-3 py-1 rounded bg-white/20 text-sm">Refresh</button>
      </div>

      {/* Create quiz */}
      <form onSubmit={submitQuiz} className="rounded-xl border border-white/15 bg-white/10 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-1">
            <label className="block text-xs mb-1">Title</label>
            <input required disabled={!cls || !subject} placeholder="Quiz title" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={form.title} onChange={e=>setForm(s=>({ ...s, title: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs mb-1">Description (optional)</label>
            <input disabled={!cls || !subject} placeholder="Short description" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={form.description} onChange={e=>setForm(s=>({ ...s, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs mb-1">Number of Questions</label>
            <input type="number" min={0} disabled={!cls || !subject} placeholder="e.g. 10" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={form.totalQuestions||''} onChange={e=>setQuestionCount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">Time Limit (mins)</label>
            <input type="number" min={0} disabled={!cls || !subject} placeholder="e.g. 15" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={form.timeLimitMinutes} onChange={e=>setForm(s=>({ ...s, timeLimitMinutes: Number(e.target.value)||0 }))} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">Questions</div>
            <div className="space-x-2">
              <button type="button" disabled={!cls || !subject} onClick={()=>addQuestion('MCQ')} className="px-2 py-1 rounded bg-white/20 text-sm">Add MCQ</button>
              <button type="button" disabled={!cls || !subject} onClick={()=>addQuestion('Short')} className="px-2 py-1 rounded bg-white/20 text-sm">Add Short Answer</button>
            </div>
          </div>
          <div className="text-[11px] text-white/70 mb-2">Tip: We auto-add/trim placeholders to match the Number of Questions. Fill them below.</div>
          <div className="space-y-3">
            {(form.questions||[]).map((q,i)=> (
              <div key={i} className="rounded-lg border border-white/15 bg-white/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={q.type} onChange={e=>updateQuestion(i,'type',e.target.value)}>
                    {['MCQ','Short'].map(x=> <option key={x} value={x}>{x}</option>)}
                  </select>
                  <button type="button" onClick={()=>removeQuestion(i)} className="ml-auto px-2 py-1 rounded bg-white/10">Remove</button>
                </div>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Question text" value={q.text} onChange={e=>updateQuestion(i,'text',e.target.value)} />
                {q.type === 'MCQ' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(q.options||[]).map((opt,j)=> (
                      <input key={j} className="bg-white/10 border border-white/20 rounded px-2 py-1" placeholder={`Option ${j+1}`} value={opt} onChange={e=>updateOption(i,j,e.target.value)} />
                    ))}
                    <input className="bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Correct answer (exact match)" value={q.correctAnswer||''} onChange={e=>updateQuestion(i,'correctAnswer',e.target.value)} />
                  </div>
                ) : (
                  <div className="text-xs text-white/70">Short answer (manual grading; AI auto-scoring planned)</div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs">Points</label>
                  <input type="number" min={0} className="bg-white/10 border border-white/20 rounded px-2 py-1 w-24" value={q.points||1} onChange={e=>updateQuestion(i,'points',Number(e.target.value)||0)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="submit" disabled={!cls || !subject || (form.questions||[]).length===0} className="px-3 py-2 rounded bg-indigo-600">Save Quiz</button>
        </div>
      </form>

      {/* List */}
      <div className="rounded-xl border border-white/15 bg-white/10 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Time Limit</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(q => (
              <tr key={q._id} className="border-t border-white/10">
                <td className="px-3 py-2">{q.title}</td>
                <td className="px-3 py-2">{q.subject}</td>
                <td className="px-3 py-2">{q.classCode}</td>
                <td className="px-3 py-2">{q.timeLimitMinutes} mins</td>
                <td className="px-3 py-2">{q.totalPoints}</td>
                <td className="px-3 py-2">{q.status}</td>
                <td className="px-3 py-2 space-x-2">
                  <button disabled={q.status!=='Draft'} onClick={()=>publishQuiz(q._id)} className="px-2 py-1 rounded bg-white/20 disabled:opacity-50">Publish</button>
                  <button onClick={()=>openSummary(q._id)} className="px-2 py-1 rounded bg-white/20">View Results</button>
                  <button disabled={q.status!=='Published'} onClick={()=>closeQuiz(q._id)} className="px-2 py-1 rounded bg-red-600 disabled:opacity-50">End Quiz</button>
                </td>
              </tr>
            ))}
            {list.length===0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-white/70">No quizzes yet for selected class/subject.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Results summary */}
      {summary && (
        <div className="rounded-xl border border-white/15 bg-white/10 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="font-medium">Results • {summary.quiz?.title}</div>
            <span className="text-xs text-white/80">Participants: {summary.count||0} • Status: {summary.quiz?.status}</span>
            <button onClick={()=>setSummary(null)} className="ml-auto px-3 py-1 rounded bg-white/20 text-sm">Close</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {(summary.participants||[]).map(p => (
                  <tr key={p.studentId} className="border-t border-white/10">
                    <td className="px-3 py-2">{p.rollNumber || '-'}</td>
                    <td className="px-3 py-2">{p.name || '-'}</td>
                    <td className="px-3 py-2">{p.totalScore}</td>
                    <td className="px-3 py-2">{p.status}</td>
                    <td className="px-3 py-2">{String(p.submittedAt||'').slice(0,10)}</td>
                  </tr>
                ))}
                {(summary.participants||[]).length===0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-white/70">No submissions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstitutionHub() {
  // Role detection from localStorage
  const ctx = useMemo(() => {
    if (typeof window === 'undefined') return { kind: 'guest' };
    const admToken = localStorage.getItem('adm_token') || '';
    const admRole = localStorage.getItem('adm_role') || '';
    const mentorToken = localStorage.getItem('mentor_token') || '';
    const studentToken = localStorage.getItem('student_token') || localStorage.getItem('token') || '';
    if (admToken && admRole === 'SCHOOL') return { kind: 'school-admin', token: admToken };
    if (admToken && admRole === 'SERVER') return { kind: 'server-admin', token: admToken };
    // Prefer mentor session over student if both exist
    if (mentorToken) return { kind: 'mentor', token: mentorToken };
    if (studentToken) return { kind: 'student', token: studentToken };
    return { kind: 'guest' };
  }, []);

  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [section, setSection] = useState("Dashboard"); // Role-based sections

  // Sections for sidebar
  const SECTIONS = useMemo(() => {
    const all = [
      { key: "Dashboard", icon: "🏠" },
      { key: "Academic Structure", icon: "🏫" },
      { key: "Students", icon: "👥" },
      { key: "Teachers", icon: "🧑‍🏫" },
      { key: "Fees", icon: "💳" },
      { key: "Trustees", icon: "🤝" },
      { key: "Attendance", icon: "📅" },
      { key: "Reports", icon: "📊" },
    ];
    // Keep only implemented features per role
    if (ctx.kind === 'school-admin') return all;
    // Mentor: Dashboard + Timetable
    if (ctx.kind === 'mentor') return [
      { key: "Dashboard", icon: "🏫" },
      { key: "Tasks", icon: "📝" },
      { key: "Quiz", icon: "🧩" },
      { key: "Timetable", icon: "📅" },
    ];
    // Student: Dashboard + Quiz section
    if (ctx.kind === 'student') return [
      { key: "Dashboard", icon: "🏫" },
      { key: "Quiz", icon: "🧩" },
    ];
    // Server admin / guest: show just Dashboard placeholder
    return [{ key: "Dashboard", icon: "🏫" }];
  }, [ctx.kind]);

  // Initialize section from query param and keep in sync
  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search);
      const s = usp.get("section");
      if (s && SECTIONS.some(x => x.key === s)) setSection(s);
    } catch (_) {}
  }, [SECTIONS]);

  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search);
      if (usp.get("section") !== section) {
        usp.set("section", section);
        const url = `${window.location.pathname}?${usp.toString()}`;
        window.history.replaceState({}, "", url);
      }
    } catch (_) {}
  }, [section]);

  // Load current school for School Admins to power the Dashboard view
  useEffect(() => {
    async function loadForSchoolAdmin() {
      if (ctx.kind !== 'school-admin') return;
      setLoading(true);
      try {
        const res = await fetch(`${API}/school/me`, { headers: { Authorization: `Bearer ${ctx.token}` } });
        const data = await res.json();
        if (res.ok) setSchool(data.school || null);
      } finally {
        setLoading(false);
      }
    }
    loadForSchoolAdmin();
  }, [ctx]);

  const title = ctx.kind === 'school-admin' ? 'Institution • Dashboard'
    : ctx.kind === 'server-admin' ? 'Institution • Dashboard'
    : ctx.kind === 'mentor' ? 'Institution • Dashboard'
    : ctx.kind === 'student' ? 'Institution • Dashboard'
    : 'Institution • Dashboard';

  function Section({ title, children }) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/10 p-4">
        <div className="text-white/90 font-medium mb-2">{title}</div>
        <div className="text-white/90 text-sm">{children}</div>
      </div>
    );
  }

  // SCHOOL ADMIN DASHBOARD (Overview)
  const renderSchoolAdmin = () => {
    if (loading) return <div className="text-white/80">Loading overview…</div>;
    if (!school) return (
      <div className="text-white/80">Couldn't load your school details. Try refresh, or go to School Admin &gt; Overview.</div>
    );
    const founders = Array.isArray(school.founders) ? school.founders : [];
    const trustees = Array.isArray(school.trustees) ? school.trustees : [];
    const photos = Array.isArray(school.photos) ? school.photos : [];
    const alumni = Array.isArray(school.alumni) ? school.alumni : [];
    const recognitions = Array.isArray(school.recognitions) ? school.recognitions : [];

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-white/30" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">🏫</div>
          )}
          <div>
            <div className="text-xl font-semibold">{school.name || 'Your School'}</div>
            <div className="text-xs text-white/80 flex items-center gap-2">
              {school.isVerified && <span className="px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-200">✔ Verified</span>}
              {school.code && <span className="px-2 py-0.5 rounded-full border border-white/30">{school.code}</span>}
              {school.establishmentYear && <span className="px-2 py-0.5 rounded-full border border-white/30">Since {school.establishmentYear}</span>}
            </div>
          </div>
          <div className="ml-auto">
            <a href="/school?tab=Overview" className="px-3 py-2 rounded bg-white/20 hover:bg-white/30 text-sm">Edit Overview →</a>
          </div>
        </div>

        {/* Overview grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Vision">
            {school.vision ? <p>{school.vision}</p> : <p className="text-white/70">Add your school's vision in Overview.</p>}
          </Section>
          <Section title="History">
            {school.history ? <p className="whitespace-pre-wrap">{school.history}</p> : <p className="text-white/70">Describe your school's history.</p>}
          </Section>
          <Section title="Founders">
            {founders.length === 0 ? (
              <div className="text-white/70">No founders listed.</div>
            ) : (
              <ul className="space-y-2">
                {founders.map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {f?.photoUrl ? <img src={f.photoUrl} alt={f?.name||'Founder'} className="h-10 w-10 rounded-full object-cover border border-white/30" /> : <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">👤</div>}
                    <div>
                      <div className="font-medium">{f?.name||'—'}</div>
                      <div className="text-xs text-white/80">{f?.title||''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Trustees">
            {trustees.length === 0 ? (
              <div className="text-white/70">No trustees listed.</div>
            ) : (
              <ul className="space-y-2">
                {trustees.map((t, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {t?.photoUrl ? <img src={t.photoUrl} alt={t?.name||'Trustee'} className="h-10 w-10 rounded-full object-cover border border-white/30" /> : <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">👤</div>}
                    <div>
                      <div className="font-medium">{t?.name||'—'}</div>
                      <div className="text-xs text-white/80">{t?.title||''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Famous Alumni">
            {alumni.length === 0 ? (
              <div className="text-white/70">No alumni added.</div>
            ) : (
              <ul className="space-y-2">
                {alumni.map((a, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {a?.photoUrl ? <img src={a.photoUrl} alt={a?.name||'Alumni'} className="h-10 w-10 rounded-full object-cover border border-white/30" /> : <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">🎓</div>}
                    <div>
                      <div className="font-medium">{a?.name||'—'} {a?.year ? <span className="text-xs text-white/70">({a.year})</span> : null}</div>
                      <div className="text-xs text-white/80">{a?.achievement||''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Recognitions & Awards">
            {recognitions.length === 0 ? (
              <div className="text-white/70">No recognitions added.</div>
            ) : (
              <ul className="space-y-2 list-disc pl-5">
                {recognitions.map((r, i) => (
                  <li key={i}>
                    <div className="font-medium">{r?.title||'—'} {r?.year ? <span className="text-xs text-white/70">({r.year})</span> : null}</div>
                    <div className="text-xs text-white/80">{[r?.issuer, r?.level].filter(Boolean).join(' • ')}</div>
                    {r?.description && <div className="text-xs text-white/80 mt-1">{r.description}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Photos */}
        <Section title="Campus Gallery">
          {photos.length === 0 ? (
            <div className="text-white/70">No photos added yet.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <img key={i} src={typeof p === 'string' ? p : (p?.url||'')} alt="Campus" className="w-full aspect-video object-cover rounded-lg border border-white/30" />
              ))}
            </div>
          )}
        </Section>
      </div>
    );
  };

  // FALLBACKS for other roles (mentor/student/server-admin) for now
  const renderComingSoon = (note) => (
    <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur p-4">
      <p className="text-white/90 text-sm">Institution Dashboard will show your school's overview here.</p>
      {note && <p className="mt-2 text-white/80 text-sm">{note}</p>}
    </div>
  );

  // ========== Academic Structure (School Admin) ==========
  const [acad, setAcad] = useState({ loading: false, year: 2026, data: null });
  useEffect(() => {
    async function loadAcademic() {
      if (ctx.kind !== 'school-admin') return;
      if (section !== 'Academic Structure') return;
      setAcad(s => ({ ...s, loading: true }));
      try {
        const res = await fetch(`${API}/school/academic-structure?year=${acad.year}`, { headers: { Authorization: `Bearer ${ctx.token}` } });
        const data = await res.json();
        if (res.ok) setAcad(s => ({ ...s, data }));
      } finally {
        setAcad(s => ({ ...s, loading: false }));
      }
    }
    loadAcademic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, section, acad.year]);

  function AcademicCards({ metrics }) {
    const items = [
      { label: 'Total Students', value: metrics?.totalStudents ?? 0 },
      { label: 'New Admissions', value: metrics?.newAdmissions ?? 0 },
      { label: 'Existing Students', value: metrics?.existingStudents ?? 0 },
      { label: 'Dropouts', value: metrics?.dropouts ?? 0 },
      { label: 'Transfers', value: metrics?.transfers ?? 0 },
    ];
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {items.map((i, idx) => (
          <div key={idx} className="rounded-xl border border-white/15 bg-white/10 p-4 text-center">
            <div className="text-2xl font-semibold">{i.value}</div>
            <div className="text-xs text-white/80 mt-1">{i.label}</div>
          </div>
        ))}
      </div>
    );
  }

  function AcademicTables({ metrics }) {
    const [drill, setDrill] = useState({ open: false, title: '', rows: [], loading: false });
    const [plans, setPlans] = useState({ byClass: {}, loading: false });
    const [feeModal, setFeeModal] = useState({ open: false, classLevel: '', totalAnnualFee: '' });
    const [config, setConfig] = useState({ classes: ['LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'], sections: ['A','B','C'], workflow: { academicYearSetup:false, classesDefined:false, sectionsDefined:false, teachersAssigned:false, studentAdmissionEnabled:false }, admissionsEnabledForYear: true });
    useEffect(() => {
      // Fetch academic config
      (async () => {
        try {
          const res = await fetch(`${API}/school/academic-config`, { headers: { Authorization: `Bearer ${ctx.token}` } });
          const data = await res.json();
          if (res.ok) setConfig({ classes: data.classes || config.classes, sections: data.sections || config.sections, workflow: data.workflowState || config.workflow });
        } catch {}
      })();
    }, []);

    useEffect(() => {
      // Load locked annual fee plans for the selected year
      (async () => {
        setPlans(s=>({ ...s, loading:true }));
        try {
          const res = await fetch(`${API}/fees/plans?year=${acad.year}`, { headers: { Authorization: `Bearer ${ctx.token}` } });
          const data = await res.json();
          if (res.ok) {
            const list = Array.isArray(data.plans) ? data.plans : [];
            const map = {};
            for (const p of list) {
              if (!p.classLevel) continue;
              // Prefer class-level (no section) as the annual baseline
              if (p.section) {
                map[p.classLevel] = map[p.classLevel] || p; // keep first if class-level not present
              } else {
                map[p.classLevel] = p;
              }
            }
            setPlans({ byClass: map, loading:false });
          } else {
            setPlans({ byClass: {}, loading:false });
          }
        } catch {
          setPlans({ byClass: {}, loading:false });
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [acad.year]);

    async function updateWorkflow(next) {
      try {
        const res = await fetch(`${API}/school/academic-config`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
          body: JSON.stringify({ workflowState: { ...config.workflow, ...next } }),
        });
        if (res.ok) {
          setConfig(s => ({ ...s, workflow: { ...s.workflow, ...next } }));
        }
      } catch {}
    }

    async function toggleAdmissions(enabled){
      try{
        const res = await fetch(`${API}/school/academic-config`, {
          method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${ctx.token}` },
          body: JSON.stringify({ admissionsToggle: { year: acad.year, enabled } })
        });
        if(res.ok){ setConfig(s=>({ ...s, admissionsEnabledForYear: enabled })); }
      } catch {}
    }

    const classOrder = config.classes || ['LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'];
    const cls = metrics?.classStrength || {};
    const sections = metrics?.sections || [];
    const warnings = metrics?.warnings || [];

    const classSum = Object.values(cls).reduce((s, v) => s + Number(v || 0), 0);
    const total = metrics?.totalStudents || 0;

    async function openDrillFor(key) {
      setDrill(s => ({ ...s, open: true, title: `Students in Class ${key}`, loading: true }));
      try {
        const res = await fetch(`${API}/school/academic-structure/drilldown?year=${acad.year}&classLevel=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${ctx.token}` } });
        const data = await res.json();
        if (res.ok) setDrill(s => ({ ...s, rows: data.students || [] }));
      } finally { setDrill(s => ({ ...s, loading: false })); }
    }

    function annualTotalOfPlan(p){
      // Backend now returns components for 3 terms or a total; support both
      if (!p) return 0;
      if (typeof p.totalAnnualFee === 'number') return p.totalAnnualFee;
      const comps = Array.isArray(p.components) ? p.components : [];
      return comps.reduce((s,c)=> s + Number(c.amount||0), 0);
    }

    function splitIntoThree(total){
      const t = Number(total||0);
      const base = Math.floor(t/3);
      const rem = t - base*3;
      return [base + (rem>0?1:0), base + (rem>1?1:0), base];
    }
    // Proper render for AcademicTables
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Workflow State */}
        <div className="md:col-span-2 rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Workflow</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={`rounded p-2 ${config.workflow.sectionsDefined ? 'bg-green-600/20 border border-green-500/40' : 'bg-white/5 border border-white/10'}`}>
              <div className="font-semibold">Sections Defined</div>
              <div className="mt-1">{config.workflow.sectionsDefined ? 'Done' : 'Pending'}</div>
              {!config.workflow.sectionsDefined && (
                <button type="button" onClick={()=>updateWorkflow({ sectionsDefined: true })} className="mt-2 text-[11px] px-2 py-1 rounded bg-white/10">Mark Done</button>
              )}
            </div>
            <div className={`rounded p-2 ${config.workflow.teachersAssigned ? 'bg-green-600/20 border border-green-500/40' : 'bg-white/5 border border-white/10'}`}>
              <div className="font-semibold">Teachers Assigned</div>
              <div className="mt-1">{config.workflow.teachersAssigned ? 'Done' : 'Pending'}</div>
            </div>
            <div className={`rounded p-2 ${config.workflow.studentAdmissionEnabled ? 'bg-green-600/20 border border-green-500/40' : 'bg-white/5 border border-white/10'}`}>
              <div className="font-semibold">Admissions Enabled (Global)</div>
              <div className="mt-1">{config.workflow.studentAdmissionEnabled ? 'Enabled' : 'Disabled'}</div>
              {!config.workflow.studentAdmissionEnabled && (
                <button type="button" onClick={()=>updateWorkflow({ studentAdmissionEnabled: true })} className="mt-2 text-[11px] px-2 py-1 rounded bg-green-600/30 border border-green-500/50">Enable</button>
              )}
            </div>
            <div className={`rounded p-2 ${config.admissionsEnabledForYear ? 'bg-green-600/20 border border-green-500/40' : 'bg-white/5 border border-white/10'}`}>
              <div className="font-semibold">Admissions (Year {acad.year})</div>
              <div className="mt-1">{config.admissionsEnabledForYear ? 'Enabled' : 'Disabled'}</div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={()=>toggleAdmissions(true)} className="text-[11px] px-2 py-1 rounded bg-green-600/30 border border-green-500/50">Enable</button>
                <button type="button" onClick={()=>toggleAdmissions(false)} className="text-[11px] px-2 py-1 rounded bg-red-600/30 border border-red-500/50">Disable</button>
              </div>
            </div>
          </div>
          {!config.workflow.studentAdmissionEnabled && (
            <div className="text-[11px] text-yellow-200/90 mt-2">Admissions are disabled. Students cannot sign up until enabled.</div>
          )}
        </div>

        {/* Warnings */}
        {(warnings.length > 0 || classSum !== total) && (
          <div className="md:col-span-2 rounded-xl border border-yellow-400/40 bg-yellow-500/10 p-3 text-sm">
            <div className="font-medium mb-1">Warnings</div>
            <ul className="list-disc ml-5 space-y-1">
              {warnings.map((w, i) => <li key={i} className="text-yellow-200/90">{w.message}</li>)}
              {(classSum !== total) && <li className="text-yellow-200/90">Class-wise sum ({classSum}) does not equal Total Students ({total}).</li>}
            </ul>
          </div>
        )}

        {/* Class-wise Strength */}
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Class-wise Strength</div>
          <div className="text-xs text-white/80 mb-2">Strength: {classSum} of Total: {total}</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {classOrder.map(k => (
              <button key={k} onClick={()=>openDrillFor(k)} className="flex items-center justify-between bg-white/5 rounded p-2 text-left">
                <span>{k}</span>
                <span className="font-semibold">{cls[k] ?? 0}</span>
              </button>
            ))}
            {Object.keys(cls).filter(k=>!classOrder.includes(k)).map(k => (
              <button key={k} onClick={()=>openDrillFor(k)} className="flex items-center justify-between bg-white/5 rounded p-2 text-left">
                <span>{k}</span>
                <span className="font-semibold">{cls[k] ?? 0}</span>
              </button>
            ))}
          </div>
          {Object.keys(cls||{}).length === 0 && (
            <div className="text-xs text-white/70 mt-2">No class assignments yet. Add classLevel to students to populate this.</div>
          )}
        </div>

        {/* Section-wise Breakup */}
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Section-wise Breakup</div>
          {sections.length === 0 ? (
            <div className="text-xs text-white/70">No section assignments yet.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {sections.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded p-2">
                  <span>{s.section}</span>
                  <span className="font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drilldown Modal */}
        {drill.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="w-[720px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{drill.title}</div>
                <button type="button" onClick={()=>setDrill({ open:false, title:'', rows:[], loading:false })} className="text-white/70">✕</button>
              </div>
              {drill.loading ? (
                <div className="text-sm text-white/80">Loading…</div>
              ) : drill.rows.length === 0 ? (
                <div className="text-sm text-white/80">No students found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Roll</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drill.rows.map((r,i) => (
                        <tr key={i} className="border-t border-white/10">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-white/80">{r.rollNumber}</td>
                          <td className="px-3 py-2">{r.assignForYear?.classLevel || r.classLevel || '-'}</td>
                          <td className="px-3 py-2">{r.assignForYear?.section || r.section || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Define Annual Fee Modal */}
        {feeModal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <form onSubmit={createAnnualFee} className="w-[420px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Define Annual Fee</div>
                <button type="button" onClick={()=>setFeeModal({ open:false, classLevel:'', totalAnnualFee:'' })} className="text-white/70">✕</button>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs mb-1">Class</div>
                  <input readOnly className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={feeModal.classLevel} />
                </div>
                <div>
                  <div className="text-xs mb-1">Annual Total (₹)</div>
                  <input type="number" min="0" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={feeModal.totalAnnualFee} onChange={e=>setFeeModal(s=>({ ...s, totalAnnualFee: e.target.value }))} />
                  {Number(feeModal.totalAnnualFee||0)>0 && (
                    <div className="text-[11px] text-white/70 mt-1">Preview terms: {splitIntoThree(Number(feeModal.totalAnnualFee)).join(' / ')}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={()=>setFeeModal({ open:false, classLevel:'', totalAnnualFee:'' })} className="px-3 py-2 rounded bg-white/10">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-indigo-600" disabled={!feeModal.classLevel || !(Number(feeModal.totalAnnualFee||0)>0)}>Save</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#b085f5] via-[#8e49c2] to-[#6a1b9a] text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">🏫</div>
            <h1 className="text-2xl font-semibold">Institution</h1>
            <span className="ml-auto text-xs text-white/80 px-2 py-0.5 rounded-full border border-white/30">{ctx.kind}</span>
          </div>

          <div className="flex gap-6 items-start">
            {/* Sidebar */}
            <aside className="w-72 hidden md:block">
              <div className="rounded-2xl bg-slate-900/70 border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <div className="text-lg font-semibold">Institution</div>
                  <div className="text-xs text-white/70">{ctx.kind==='school-admin'?'School Admin':ctx.kind==='mentor'?'Mentor':'Institution'}</div>
                </div>
                <nav className="p-2 space-y-1">
                  {SECTIONS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setSection(s.key)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition ${section===s.key? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'}`}
                    >
                      <span className="text-lg leading-none">{s.icon}</span>
                      <span className="text-sm font-medium">{s.key}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Content */}
            <main className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-3 py-1 rounded-full border border-white/20 bg-white/10 text-xs">{section}</div>
                {section === 'Dashboard' && <div className="text-xs text-white/80">Overview</div>}
              </div>

              {section === 'Dashboard' && (
                <>
                  {ctx.kind === 'school-admin' && renderSchoolAdmin()}
                  {ctx.kind === 'server-admin' && renderComingSoon("Select a school in Server Admin to edit overview. We'll add a details view here.")}
                  {ctx.kind === 'student' && <StudentDashboard token={ctx.token} />}
                  {ctx.kind === 'guest' && renderComingSoon()}
                </>
              )}

              {/* Mentor features removed: Tasks/Assessments consolidated under Teachers */}

              {section === 'Quiz' && (
                ctx.kind === 'student' ? (
                  <StudentQuiz token={ctx.token} />
                ) : ctx.kind === 'mentor' ? (
                  <MentorAssessments token={ctx.token} />
                ) : renderComingSoon("Quiz section is available for Students and Mentors.")
              )}

              {section === 'Tasks' && (
                ctx.kind === 'mentor' ? (
                  <TeacherDashboard token={ctx.token} tasksInline={true} />
                ) : renderComingSoon("Only Mentors can manage class tasks here.")
              )}

              {/* Assessments merged into Quiz for mentors */}

              {section === 'Timetable' && (
                ctx.kind === 'mentor' ? (
                  <MentorTimetable token={ctx.token} />
                ) : renderComingSoon("Only Mentors can view timetable here.")
              )}

              {section === 'Academic Structure' && (
                ctx.kind === 'school-admin' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-white/80">Academic Year</div>
                      <select
                        className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm"
                        value={acad.year}
                        onChange={e=>setAcad(s=>({...s, year: Number(e.target.value)||s.year }))}
                      >
                        {Array.from({ length: 2025 - 2015 + 1 }, (_, i) => 2015 + i).map(y => (
                          <option className="text-black" key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      {acad.loading && <span className="text-xs text-white/80">Loading…</span>}
                    </div>
                    {acad.data ? (
                      <>
                        <AcademicCards metrics={acad.data} />
                        <AcademicTables metrics={acad.data} />
                      </>
                    ) : (
                      <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-sm text-white/80">No data yet for {acad.year}. Once students are approved and class/section are assigned, metrics will appear here.</div>
                    )}
                  </div>
                ) : renderComingSoon("Only School Admins can view academic structure here.")
              )}
              {section === 'Students' && (
                ctx.kind === 'school-admin' ? (
                  <SchoolAdminStudents token={ctx.token} />
                ) : renderComingSoon("Only School Admins can manage students here.")
              )}
              {section === 'Teachers' && (
                ctx.kind === 'school-admin' ? (
                  <SchoolAdminTeachers token={ctx.token} />
                ) : renderComingSoon("Only School Admins can manage teachers here.")
              )}
              {section === 'Fees' && (
                ctx.kind === 'school-admin' ? (
                  <SchoolAdminFees token={ctx.token} />
                ) : renderComingSoon("Only School Admins can manage fees here.")
              )}
              {section === 'Trustees' && (
                ctx.kind === 'school-admin' ? (
                  <SchoolAdminTrustees token={ctx.token} />
                ) : renderComingSoon("Only School Admins can manage trustees here.")
              )}
              {section === 'Attendance' && (
                ctx.kind === 'school-admin' ? (
                  <SchoolAdminAttendance token={ctx.token} />
                ) : renderComingSoon("Only School Admins can manage attendance here.")
              )}
              {section === 'Reports' && (
                ctx.kind === 'school-admin' ? (
                  <SchoolAdminReports token={ctx.token} />
                ) : renderComingSoon("Only School Admins can view reports here.")
              )}
            </main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

// ------- Students Management (School Admin) -------
function StudentDashboard({ token }) {
  const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ classLevel: "", section: "", classCode: "", todaysHomework: [], upcomingDeadlines: [], quizNotifications: [] });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/student/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setData(d || {});
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="font-medium">Student Dashboard</div>
        {loading && <span className="text-xs text-white/80">Loading…</span>}
        <button onClick={load} className="ml-auto px-3 py-1 rounded bg-white/20 text-sm">Refresh</button>
      </div>

      {/* Class & Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Class & Section</div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">Class: {data.classLevel || '-'}</span>
            <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">Section: {data.section || '-'}</span>
            {data.classCode && <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">{data.classCode}</span>}
            {/* Student details */}
            {data?.student?.name && (
              <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">Student: {data.student.name}</span>
            )}
            {data?.student?.rollNumber && (
              <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">Roll: {data.student.rollNumber}</span>
            )}
            {/* Class teacher */}
            <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">Class Teacher: {data.classTeacherName || '-'}</span>
          </div>
        </div>

        {/* Quiz notifications */}
        <div className="md:col-span-2 rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Quiz notifications</div>
          {Array.isArray(data.quizNotifications) && data.quizNotifications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Points</th>
                    <th className="px-3 py-2">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quizNotifications.map(q => (
                    <tr key={q._id} className="border-t border-white/10">
                      <td className="px-3 py-2">{q.title}</td>
                      <td className="px-3 py-2">{q.subject}</td>
                      <td className="px-3 py-2">{typeof q.totalPoints === 'number' ? q.totalPoints : '-'}</td>
                      <td className="px-3 py-2 text-white/80">{q.createdAt ? String(q.createdAt).slice(0,10) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-white/70">No new quizzes in the last 7 days.</div>
          )}
        </div>
      </div>

      {/* Today’s homework */}
      <div className="rounded-xl border border-white/15 bg-white/10 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="font-medium">Today’s homework</div>
        </div>
        {Array.isArray(data.todaysHomework) && data.todaysHomework.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {data.todaysHomework.map(h => (
                  <tr key={h._id} className="border-t border-white/10">
                    <td className="px-3 py-2">{h.subject}</td>
                    <td className="px-3 py-2">{h.topic}</td>
                    <td className="px-3 py-2 text-white/80 truncate max-w-[360px]">{h.description || '-'}</td>
                    <td className="px-3 py-2">{String(h.deadline||'').slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-white/70">No homework due today.</div>
        )}
      </div>

      {/* Upcoming deadlines */}
      <div className="rounded-xl border border-white/15 bg-white/10 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="font-medium">Upcoming deadlines (next 7 days)</div>
        </div>
        {Array.isArray(data.upcomingDeadlines) && data.upcomingDeadlines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingDeadlines.map(h => (
                  <tr key={h._id} className="border-t border-white/10">
                    <td className="px-3 py-2">{h.subject}</td>
                    <td className="px-3 py-2">{h.topic}</td>
                    <td className="px-3 py-2 text-white/80 truncate max-w-[360px]">{h.description || '-'}</td>
                    <td className="px-3 py-2">{String(h.deadline||'').slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-white/70">No upcoming deadlines in the next week.</div>
        )}
      </div>
    </div>
  );
}

// ------- Student Quiz Section -------
function StudentQuiz({ token }) {
  const API = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";
  const [loading, setLoading] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [subject, setSubject] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [attempted, setAttempted] = useState({}); // { quizId: { status, score } }
  const [deadlineTs, setDeadlineTs] = useState(null); // epoch ms
  const [timeLeft, setTimeLeft] = useState(null); // ms

  async function loadQuizzes() {
    setLoading(true);
    try {
      const usp = new URLSearchParams();
      if (subject) usp.set("subject", subject);
      const res = await fetch(`${API}/student/quizzes/active?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setQuizzes(Array.isArray(d) ? d : []);
      // Load attempted quiz status to disable re-attempts visually
      try {
        const prog = await fetch(`${API}/student/progress`, { headers: { Authorization: `Bearer ${token}` } });
        const pd = await prog.json();
        if (prog.ok) {
          const map = {};
          for (const qs of (pd.quizScores||[])) {
            map[String(qs.quizId)] = { status: qs.status, score: qs.score, totalPoints: qs.totalPoints };
          }
          setAttempted(map);
        }
      } catch {}
    } finally { setLoading(false); }
  }
  useEffect(() => { loadQuizzes(); }, [subject]);

  async function openQuiz(id) {
    setSelectedId(id);
    setQuiz(null);
    setResult(null);
    setAnswers([]);
    try {
      const detailsRes = await fetch(`${API}/student/quizzes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (detailsRes.status === 403) {
        const err = await detailsRes.json().catch(()=>({}));
        alert(err?.message || 'Quiz not available');
        return;
      }
      const q = await detailsRes.json();
      if (detailsRes.ok) {
        setQuiz(q);
        setAnswers((q.questions||[]).map((_, idx) => ({ questionIndex: idx, answer: "" })));
        // Setup timer based on timeLimit; persist a per-quiz deadline to survive refresh
        const mins = Number(q.timeLimitMinutes||0);
        if (mins > 0) {
          const key = `quizDeadline:${q._id}`;
          const now = Date.now();
          let dl = Number(localStorage.getItem(key) || 0);
          if (!dl || dl < now) {
            dl = now + mins * 60 * 1000;
            localStorage.setItem(key, String(dl));
          }
          setDeadlineTs(dl);
          setTimeLeft(Math.max(0, dl - now));
        } else {
          setDeadlineTs(null);
          setTimeLeft(null);
        }
      } else {
        const err = await detailsRes.json().catch(()=>({}));
        alert(err?.message || 'Failed to load quiz');
      }
    } catch {}
  }

  function setAnswer(idx, val) {
    setAnswers(a => a.map(x => x.questionIndex === idx ? { ...x, answer: val } : x));
  }

  async function submit(auto=false) {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/student/quizzes/${quiz._id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers })
      });
      const d = await res.json();
      if (res.ok) {
        setResult(d);
        // Mark as attempted in UI
        setAttempted(a => ({ ...a, [String(quiz._id)]: { status: d.status, score: d.totalScore, totalPoints: quiz.totalPoints } }));
        // Clear deadline persistence
        try { localStorage.removeItem(`quizDeadline:${quiz._id}`); } catch {}
      } else {
        if (!auto) alert(d?.message || 'Submission failed');
      }
    } finally { setSubmitting(false); }
  }

  // Timer tick: update remaining every second; auto-submit when time is up
  useEffect(() => {
    if (!quiz || !deadlineTs) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const now = Date.now();
      const left = Math.max(0, deadlineTs - now);
      setTimeLeft(left);
      if (left === 0 && !submitting && !result) {
        submit(true);
      }
    };
    const t = setInterval(tick, 1000);
    tick();
    return () => { stopped = true; clearInterval(t); };
  }, [quiz, deadlineTs, submitting, result]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="font-medium">Quiz</div>
        {loading && <span className="text-xs text-white/80">Loading…</span>}
        <button onClick={loadQuizzes} className="ml-auto px-3 py-1 rounded bg-white/20 text-sm">Refresh</button>
      </div>

      {/* Filters + Active quizzes list */}
      {!quiz && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm">Subject</label>
            <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={subject} onChange={e=>setSubject(e.target.value)}>
              <option className="text-black" value="">All</option>
              {/* Subject list can be dynamic later */}
              {['English','Kannada','Chemistry','Physics','Biology','Mathematics','Accounts'].map(s=> (
                <option className="text-black" key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(quizzes||[]).map(q => (
                  <tr key={q._id} className="border-t border-white/10">
                    <td className="px-3 py-2">{q.title}</td>
                    <td className="px-3 py-2">{q.subject}</td>
                    <td className="px-3 py-2">{q.totalPoints}</td>
                    <td className="px-3 py-2">
                      {attempted[String(q._id)] ? (
                        <span className="px-2 py-1 rounded bg-white/10 text-white/80">
                          {attempted[String(q._id)].status || 'Attempted'}{attempted[String(q._id)].score!=null ? ` • ${attempted[String(q._id)].score}/${attempted[String(q._id)].totalPoints ?? ''}` : ''}
                        </span>
                      ) : (
                        <button onClick={()=>openQuiz(q._id)} className="px-2 py-1 rounded bg-indigo-600">Attempt</button>
                      )}
                    </td>
                  </tr>
                ))}
                {quizzes.length===0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-white/70">No active quizzes for your class.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Attempt view */}
      {quiz && (
        <div className="rounded-xl border border-white/15 bg-white/10 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="font-medium">{quiz.title}</div>
            <span className="text-xs text-white/80">{quiz.subject}</span>
            <button onClick={()=>{ setQuiz(null); setSelectedId(null); setResult(null); }} className="ml-auto px-3 py-1 rounded bg-white/20 text-sm">Back</button>
          </div>
          <div className="text-xs text-white/80">
            Time limit: {quiz.timeLimitMinutes || 0} mins • Total points: {quiz.totalPoints || 0}
            {typeof timeLeft === 'number' && (
              <span className="ml-3 px-2 py-0.5 rounded bg-white/10 border border-white/20">Time left: {new Date(timeLeft).toISOString().substr(14,5)}</span>
            )}
          </div>

          {(quiz.questions||[]).map((q, i) => (
            <div key={i} className="rounded-lg border border-white/15 bg-white/5 p-3 space-y-2">
              <div className="text-sm font-medium">Q{i+1}. {q.text}</div>
              {q.type === 'MCQ' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(q.options||[]).map((opt, j) => (
                    <label key={j} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`q-${i}`} value={opt} disabled={typeof timeLeft==='number' && timeLeft===0} checked={answers.find(a=>a.questionIndex===i)?.answer===opt} onChange={e=>setAnswer(i, e.target.value)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Type your answer" disabled={typeof timeLeft==='number' && timeLeft===0} value={answers.find(a=>a.questionIndex===i)?.answer||""} onChange={e=>setAnswer(i, e.target.value)} />
              )}
              <div className="text-xs text-white/70">Points: {q.points||1}</div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-2">
            <button disabled={submitting || (typeof timeLeft==='number' && timeLeft===0 && !result)} onClick={()=>submit(false)} className="px-3 py-2 rounded bg-emerald-600 disabled:opacity-50">Submit</button>
          </div>

          {result && (
            <div className="rounded-lg border border-white/15 bg-white/5 p-3 space-y-2">
              <div className="font-medium">Result</div>
              <div className="text-sm">Score: {result.totalScore} / {quiz.totalPoints}</div>
              {result.badgeAwarded?.name && (
                <div className="text-sm">Badge earned: <span className="px-2 py-0.5 rounded-full border border-white/20">{result.badgeAwarded.name}</span></div>
              )}
              <div className="space-y-1">
                {(result.feedback||[]).map((f, idx) => (
                  <div key={idx} className="text-xs text-white/80">Q{(f.questionIndex||0)+1}: {f.feedback} • +{f.pointsAwarded} pts</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SchoolAdminStudents({ token }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState({ open: false, id: null, data: {} });
  const [classLevel, setClassLevel] = useState("");

  const CLASS_ORDER = ["","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"]; // '' = All

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const usp = new URLSearchParams();
      // Backend expects academic year; default to current year but keep UI class-wise
      usp.set('year', new Date().getFullYear());
      if (classLevel) usp.set('classLevel', classLevel);
      if (q) usp.set('q', q);
      usp.set('status', 'Approved');
      const res = await fetch(`${API}/school/students/manage?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(()=>({}));
      if (res.ok) {
        setRows(data.students || []);
      } else {
        // Fallback: use simpler list endpoint to avoid blank table on errors
        // Fallback API doesn't support classLevel filtering server-side, so we will filter on the client
        const res2 = await fetch(`${API}/school/students?status=Approved${q?`&q=${encodeURIComponent(q)}`:''}`, { headers:{ Authorization:`Bearer ${token}` } });
        const d2 = await res2.json().catch(()=>({}));
        if (res2.ok) {
          const mappedRaw = (d2.students||[]).map(s=> ({
            id: s._id || s.id,
            name: s.name,
            rollNumber: s.rollNumber,
            classLevel: s.classLevel || s.department,
            section: s.section,
            parentDetails: s.parentDetails,
            admissionYear: s.admissionYear,
            admissionDate: s.admissionDate,
            fee: s.fee,
            attendancePct: s.attendancePct,
            performanceScore: s.performanceScore,
            teacherRemarks: s.teacherRemarks,
          }));
          function matchesSelectedClass(rowCls, selected){
            if (!selected) return true;
            const cls = String(rowCls||'').trim();
            if (!cls) return false;
            if (selected === 'LKG' || selected === 'UKG') return new RegExp(`^${selected}$`, 'i').test(cls);
            const n = (selected.match(/\d{1,2}/)||[])[0] || selected;
            // Match variants like "Class 8", "8th", "Std 8", or just "8"
            return new RegExp(`(^|[^\\d])${n}([^\\d]|$)`, 'i').test(cls);
          }
          const mapped = classLevel ? mappedRaw.filter(r => matchesSelectedClass(r.classLevel, classLevel)) : mappedRaw;
          setRows(mapped);
        } else {
          setErr(d2?.message || 'Failed to load students');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, [classLevel]);

  async function saveEdit(e) {
    e.preventDefault();
    // Normalize and validate parent contact (10 digits only)
    const rawContact = edit.data?.parentDetails?.contact || "";
    const normContact = String(rawContact).replace(/\D/g, "").slice(0, 10);
    if (rawContact && normContact.length !== 10) {
      alert("Parent Contact must be a 10-digit number");
      return;
    }
    const payload = {
      classLevel: edit.data.classLevel,
      section: edit.data.section,
      parentDetails: {
        ...(edit.data.parentDetails || {}),
        contact: normContact || undefined,
      },
      admissionDate: edit.data.admissionDate,
      fee: edit.data.fee,
      teacherRemarks: edit.data.teacherRemarks,
    };
    const res = await fetch(`${API}/school/students/${edit.id}/manage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEdit({ open:false, id:null, data:{} });
      load();
    }
  }

  function openEdit(r){
    setEdit({ open:true, id:r.id, data: {
      classLevel: r.classLevel||'', section: r.section||'',
      parentDetails: r.parentDetails||{ name:'', occupation:'', contact:'' },
      admissionDate: r.admissionDate ? String(r.admissionDate).slice(0,10) : '',
      fee: { plan:r.fee?.plan||'', status:r.fee?.status||'Pending', dueAmount:r.fee?.dueAmount||0, paidAmount:r.fee?.paidAmount||0 },
      teacherRemarks: r.teacherRemarks||'',
    } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-white/80">Class</div>
          <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={classLevel} onChange={e=>setClassLevel(e.target.value)}>
            {CLASS_ORDER.map(c=> <option className="text-black" key={c} value={c}>{c || 'All'}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name/roll/class/section" className="bg-white/10 border border-white/20 rounded px-3 py-1 text-sm" />
          <button onClick={load} className="px-3 py-1 rounded bg-white/20 text-sm">Search</button>
          {loading && <span className="text-xs text-white/80">Loading…</span>}
        </div>
      </div>

      <div className="rounded-xl border border-white/15 bg-white/10 overflow-x-auto">
        {err && <div className="p-2 text-sm text-red-300">{err}</div>}
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Parent</th>
              <th className="px-3 py-2">Admission</th>
              <th className="px-3 py-2">Fee Status</th>
              <th className="px-3 py-2">Due/Paid</th>
              <th className="px-3 py-2">Attendance %</th>
              <th className="px-3 py-2">Performance</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-white/80">{r.rollNumber}</td>
                <td className="px-3 py-2">{r.classLevel||'-'}</td>
                <td className="px-3 py-2">{r.section||'-'}</td>
                <td className="px-3 py-2 text-white/80">{r.parentDetails?.name||'-'} {r.parentDetails?.contact?`(${r.parentDetails.contact})`:''}</td>
                <td className="px-3 py-2 text-white/80">{r.admissionDate? String(r.admissionDate).slice(0,10) : (r.admissionYear||'-')}</td>
                <td className="px-3 py-2">{r.fee?.status||'Pending'}</td>
                <td className="px-3 py-2 text-white/80">₹{Number(r.fee?.dueAmount||0)} / ₹{Number(r.fee?.paidAmount||0)}</td>
                <td className="px-3 py-2">{typeof r.attendancePct==='number'? `${r.attendancePct}%` : '-'}</td>
                <td className="px-3 py-2">{typeof r.performanceScore==='number'? r.performanceScore : '-'}</td>
                <td className="px-3 py-2 text-white/80 truncate max-w-[200px]">{r.teacherRemarks||''}</td>
                <td className="px-3 py-2 space-x-2">
                  <button onClick={()=>openEdit(r)} className="px-2 py-1 rounded bg-white/20">Edit</button>
                  <button onClick={()=>removeStudent(r)} className="px-2 py-1 rounded bg-red-600/80">Remove</button>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={12} className="px-3 py-6 text-center text-white/70">No students match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {edit.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <form onSubmit={saveEdit} className="w-[680px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Edit Student</div>
              <button type="button" onClick={()=>setEdit({open:false,id:null,data:{}})} className="text-white/70">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Class</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.classLevel||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, classLevel:e.target.value}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Section</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.section||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, section:e.target.value}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Parent Name</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.parentDetails?.name||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, parentDetails:{ ...(s.data.parentDetails||{}), name:e.target.value }}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Parent Occupation</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.parentDetails?.occupation||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, parentDetails:{ ...(s.data.parentDetails||{}), occupation:e.target.value }}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Parent Contact</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  title="Enter exactly 10 digits (no country code)"
                  placeholder="10-digit mobile (no +91)"
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1"
                  value={(edit.data.parentDetails?.contact||'')}
                  onChange={e=>{
                    const digits = e.target.value.replace(/\D/g, '').slice(0,10);
                    setEdit(s=>({...s, data:{...s.data, parentDetails:{ ...(s.data.parentDetails||{}), contact:digits }}}));
                  }}
                />
                {(!edit.data.parentDetails?.contact) && (
                  <p className="text-xs text-white/50 mt-1">Enter 10 digits, numbers only.</p>
                )}
                {(edit.data.parentDetails?.contact && String(edit.data.parentDetails.contact).length!==10) && (
                  <p className="text-xs text-red-300 mt-1">Phone must be exactly 10 digits (no country code).</p>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1">Admission Date</label>
                <input type="date" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.admissionDate||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, admissionDate:e.target.value}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Fee Plan</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.fee?.plan||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, fee:{ ...(s.data.fee||{}), plan:e.target.value }}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Fee Status</label>
                <select className="w-full bg-white text-black border border-white/20 rounded px-2 py-1" value={edit.data.fee?.status||'Pending'} onChange={e=>setEdit(s=>({...s, data:{...s.data, fee:{ ...(s.data.fee||{}), status:e.target.value }}}))}>
                  {['Pending','Partial','Paid'].map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Due Amount</label>
                <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.fee?.dueAmount||0} onChange={e=>setEdit(s=>({...s, data:{...s.data, fee:{ ...(s.data.fee||{}), dueAmount:Number(e.target.value)||0 }}}))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Paid Amount</label>
                <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.fee?.paidAmount||0} onChange={e=>setEdit(s=>({...s, data:{...s.data, fee:{ ...(s.data.fee||{}), paidAmount:Number(e.target.value)||0 }}}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1">Teacher Remarks</label>
                <textarea rows={3} className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={edit.data.teacherRemarks||''} onChange={e=>setEdit(s=>({...s, data:{...s.data, teacherRemarks:e.target.value}}))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setEdit({open:false,id:null,data:{}})} className="px-3 py-2 rounded bg-white/10">Cancel</button>
              <button
                type="submit"
                disabled={Boolean(edit.data.parentDetails?.contact) && String(edit.data.parentDetails?.contact||'').length!==10}
                className="px-3 py-2 rounded bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
// helper to call admin delete
async function removeStudent(r){
  if (!window.confirm(`Remove ${r.name}? This cannot be undone and the student will be blacklisted.`)) return;
  try{
    const res = await fetch(`${API}/school/students/${encodeURIComponent(r.id)}`, { method:'DELETE', headers:{ Authorization:`Bearer ${localStorage.getItem('adm_token')||''}` }});
    if(res.ok){
      alert('Removed');
      // naive reload; component-scoped load will refresh on reopen
      window.location.reload();
    } else {
      const e = await res.json().catch(()=>({}));
      alert(e?.message||'Failed to remove');
    }
  } catch {
    alert('Failed to remove');
  }
}

// ------- Fees Management (School Admin) -------
function SchoolAdminFees({ token }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [tracking, setTracking] = useState({ rows: [], loading: false, q: "", classLevel: "", section: "", status: "Due" });
  const [createPlan, setCreatePlan] = useState({ open: false, data: { academicYear: new Date().getFullYear(), classLevel: "", section: "", title: "", frequency: "Annual", components: [{ name: "Tuition", amount: 0 }], dueDates: [] } });
  const [pay, setPay] = useState({ open: false, id: null, data: { amount: 0, method: "Cash", receiptNo: "", notes: "", date: "" } });
  const CLASS_FILTER = ["","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"]; // '' = All

  async function loadPlans() {
    setLoadingPlans(true);
    try {
      const res = await fetch(`${API}/fees/plans?year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setPlans(data.plans || []);
    } finally { setLoadingPlans(false); }
  }

  async function loadTracking() {
    setTracking(s => ({ ...s, loading: true }));
    try {
      const usp = new URLSearchParams();
      usp.set('year', year);
      if (tracking.q) usp.set('q', tracking.q);
      if (tracking.classLevel) usp.set('classLevel', tracking.classLevel);
      if (tracking.section) usp.set('section', tracking.section);
      if (tracking.status) usp.set('status', tracking.status);
      const res = await fetch(`${API}/fees/students/tracking?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setTracking(s => ({ ...s, rows: data.students || [] }));
    } finally { setTracking(s => ({ ...s, loading: false })); }
  }

  useEffect(() => { loadPlans(); }, [year]);
  useEffect(() => { loadTracking(); }, [year, tracking.classLevel, tracking.status]);

  function totalOfPlan(p) {
    const comps = Array.isArray(p.components) ? p.components : [];
    return comps.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }

  async function createOrUpdatePlan(e) {
    e.preventDefault();
    const payload = { ...createPlan.data, academicYear: Number(createPlan.data.academicYear) || year, dueDates: (createPlan.data.dueDates||[]).filter(Boolean) };
    const res = await fetch(`${API}/fees/plans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
    });
    if (res.ok) {
      setCreatePlan({ open: false, data: { academicYear: year, classLevel: "", section: "", title: "", frequency: "Annual", components: [{ name: "Tuition", amount: 0 }], dueDates: [] } });
      loadPlans();
    }
  }

  function addComponentRow() {
    setCreatePlan(s => ({ ...s, data: { ...s.data, components: [...(s.data.components||[]), { name: "", amount: 0 }] } }));
  }
  function updateComponent(i, field, value) {
    setCreatePlan(s => ({ ...s, data: { ...s.data, components: (s.data.components||[]).map((c, idx) => idx===i ? { ...c, [field]: field==='amount' ? Number(value)||0 : value } : c ) } }));
  }
  function removeComponent(i) {
    setCreatePlan(s => ({ ...s, data: { ...s.data, components: (s.data.components||[]).filter((_, idx) => idx!==i) } }));
  }

  function openPay(r) {
    setPay({ open: true, id: r.id, data: { amount: 0, method: "Cash", receiptNo: "", notes: "", date: new Date().toISOString().slice(0,10) } });
  }
  async function submitPay(e) {
    e.preventDefault();
    const payload = { ...pay.data, amount: Number(pay.data.amount || 0) };
    const res = await fetch(`${API}/fees/students/${pay.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) {
      setPay({ open: false, id: null, data: { amount: 0, method: "Cash", receiptNo: "", notes: "", date: "" } });
      loadTracking();
    }
  }

  async function exportCsv(period) {
    const usp = new URLSearchParams();
    usp.set('period', period);
    usp.set('year', year);
    if (period === 'monthly') {
      const m = prompt('Enter month (1-12) for export:', '1');
      if (!m) return;
      usp.set('month', String(Number(m)||1));
    }
    if (tracking.classLevel) usp.set('classLevel', tracking.classLevel);
    if (tracking.section) usp.set('section', tracking.section);
    const res = await fetch(`${API}/fees/reports/export?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fee-report-${period}-${year}${usp.get('month')?('-'+usp.get('month')):''}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-white/80">Academic Year</div>
          <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map(y=> <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>exportCsv('monthly')} className="px-3 py-1 rounded bg-white/20 text-sm">Export Monthly CSV</button>
          <button onClick={()=>exportCsv('yearly')} className="px-3 py-1 rounded bg-white/20 text-sm">Export Yearly CSV</button>
        </div>
      </div>

      {/* Plans */}
      <div className="rounded-xl border border-white/15 bg-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Class-wise Fee Plans</div>
          <button onClick={()=>setCreatePlan(s=>({ ...s, open: true }))} className="px-3 py-1 rounded bg-white/20 text-sm">Create Plan</button>
        </div>
        {loadingPlans ? (
          <div className="text-sm text-white/80">Loading plans…</div>
        ) : plans.length === 0 ? (
          <div className="text-sm text-white/80">No plans for {year}. Create one to set fees per class/section.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Frequency</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Components</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p._id} className="border-t border-white/10">
                    <td className="px-3 py-2">{p.academicYear}</td>
                    <td className="px-3 py-2">{p.classLevel}</td>
                    <td className="px-3 py-2">{p.section || '-'}</td>
                    <td className="px-3 py-2">{p.title || '-'}</td>
                    <td className="px-3 py-2">{p.frequency}</td>
                    <td className="px-3 py-2">₹{totalOfPlan(p)}</td>
                    <td className="px-3 py-2 text-white/80">{(p.components||[]).map(c=>`${c.name} ₹${c.amount}`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracking */}
      <div className="rounded-xl border border-white/15 bg-white/10 p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="font-medium">Student Fee Tracking</div>
          {tracking.loading && <span className="text-xs text-white/80">Loading…</span>}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm text-white/80">Class</div>
              <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={tracking.classLevel} onChange={e=>setTracking(s=>({ ...s, classLevel: e.target.value }))}>
                {CLASS_FILTER.map(c=> <option key={c} value={c}>{c || 'All'}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-white/80">Status</div>
              <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={tracking.status} onChange={e=>setTracking(s=>({ ...s, status: e.target.value }))}>
                {['Due','Pending'].map(x=> <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <input value={tracking.q} onChange={e=>setTracking(s=>({ ...s, q: e.target.value }))} placeholder="Search name/roll/email" className="bg-white/10 border border-white/20 rounded px-3 py-1 text-sm" />
            <button onClick={loadTracking} className="px-3 py-1 rounded bg-white/20 text-sm">Search</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Roll</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Total Fee</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Pending</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last Payment</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracking.rows.map(r => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-white/80">{r.rollNumber}</td>
                  <td className="px-3 py-2">{r.classLevel || '-'}</td>
                  <td className="px-3 py-2">{r.section || '-'}</td>
                  <td className="px-3 py-2">₹{Number(r.fee?.totalFee||0)}</td>
                  <td className="px-3 py-2">₹{Number(r.fee?.paidAmount||0)}</td>
                  <td className="px-3 py-2">₹{Number(r.fee?.pendingBalance||0)}</td>
                  <td className="px-3 py-2">{r.fee?.status || 'Pending'}</td>
                  <td className="px-3 py-2 text-white/80">{r.fee?.lastPaymentDate ? String(r.fee.lastPaymentDate).slice(0,10) : '-'}</td>
                  <td className="px-3 py-2"><button onClick={()=>openPay(r)} className="px-2 py-1 rounded bg-white/20">Record Payment</button></td>
                </tr>
              ))}
              {tracking.rows.length===0 && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-white/70">No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Plan Modal */}
      {createPlan.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <form onSubmit={createOrUpdatePlan} className="w-[720px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Create Fee Plan</div>
              <button type="button" onClick={()=>setCreatePlan({ open:false, data: createPlan.data })} className="text-white/70">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Academic Year</label>
                <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={createPlan.data.academicYear} onChange={e=>setCreatePlan(s=>({ ...s, data: { ...s.data, academicYear: Number(e.target.value)||year } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Class</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={createPlan.data.classLevel} onChange={e=>setCreatePlan(s=>({ ...s, data: { ...s.data, classLevel: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Section (optional)</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={createPlan.data.section||''} onChange={e=>setCreatePlan(s=>({ ...s, data: { ...s.data, section: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Title (optional)</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={createPlan.data.title||''} onChange={e=>setCreatePlan(s=>({ ...s, data: { ...s.data, title: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Frequency</label>
                <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={createPlan.data.frequency} onChange={e=>setCreatePlan(s=>({ ...s, data: { ...s.data, frequency: e.target.value } }))}>
                  {['Annual','Term','Monthly'].map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="text-xs mb-2">Components</div>
              <div className="space-y-2">
                {(createPlan.data.components||[]).map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className="col-span-7 bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Name" value={c.name} onChange={e=>updateComponent(i,'name',e.target.value)} />
                    <input type="number" className="col-span-3 bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Amount" value={c.amount} onChange={e=>updateComponent(i,'amount',e.target.value)} />
                    <button type="button" onClick={()=>removeComponent(i)} className="col-span-2 px-2 py-1 rounded bg-white/10">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={addComponentRow} className="px-3 py-1 rounded bg-white/20 text-sm">Add Component</button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setCreatePlan(s=>({ ...s, open:false }))} className="px-3 py-2 rounded bg-white/10">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600">Save Plan</button>
            </div>
          </form>
        </div>
      )}

      {/* Record Payment Modal */}
      {pay.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <form onSubmit={submitPay} className="w-[520px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Record Payment</div>
              <button type="button" onClick={()=>setPay({ open:false, id:null, data:{ amount:0, method:'Cash', receiptNo:'', notes:'', date:'' } })} className="text-white/70">✕</button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs mb-1">Amount (₹)</label>
                <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.amount} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, amount: Number(e.target.value)||0 } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Method</label>
                <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.method} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, method: e.target.value } }))}>
                  {['Cash','UPI','Bank','Cheque','Other'].map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Receipt No (optional)</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.receiptNo} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, receiptNo: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Notes (optional)</label>
                <textarea rows={3} className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.notes} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, notes: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Date</label>
                <input type="date" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.date||''} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, date: e.target.value } }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setPay({ open:false, id:null, data:{ amount:0, method:'Cash', receiptNo:'', notes:'', date:'' } })} className="px-3 py-2 rounded bg-white/10">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600">Save Payment</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

// ------- Teacher Dashboard (Mentor/Teacher role) -------
function TeacherDashboard({ token, tasksInline = false }) {
  const [data, setData] = useState({ teacher: {}, assigned: { classes: [], subjects: [] }, todaySchedule: [], pending: {} });
  const [loading, setLoading] = useState(false);
  // Homework state
  const [hwClass, setHwClass] = useState("");
  const [hwList, setHwList] = useState([]);
  const [hwLoading, setHwLoading] = useState(false);
  const [hwForm, setHwForm] = useState({ subject: "", topic: "", description: "", deadline: "" });
  const [hwEdit, setHwEdit] = useState({ open: false, id: null, data: {} });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/institution/teacher/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setData(d);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function loadHomework(cls) {
    const classCode = cls || hwClass;
    if (!classCode) return;
    setHwLoading(true);
    try {
      const res = await fetch(`${API}/institution/homework?classCode=${encodeURIComponent(classCode)}`, { headers: { Authorization: `Bearer ${token}` } });
      const list = await res.json();
      if (res.ok) setHwList(Array.isArray(list)? list : []);
    } finally { setHwLoading(false); }
  }

  async function submitHomework(e) {
    e.preventDefault();
    if (!hwClass) return alert("Select class");
    const payload = hwForm;
    const res = await fetch(`${API}/institution/homework/${encodeURIComponent(hwClass)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) { setHwForm({ subject: "", topic: "", description: "", deadline: "" }); loadHomework(); }
    else { const err = await res.json().catch(()=>({})); alert(err?.message || 'Failed to create homework'); }
  }

  function openHwEdit(item) {
    setHwEdit({ open: true, id: item._id, data: { subject: item.subject, topic: item.topic, description: item.description || "", deadline: String(item.deadline || '').slice(0,10), status: item.status } });
  }
  async function saveHwEdit(e) {
    e.preventDefault();
    const res = await fetch(`${API}/institution/homework/${hwEdit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(hwEdit.data) });
    if (res.ok) { setHwEdit({ open:false, id:null, data:{} }); loadHomework(); }
    else { const err = await res.json().catch(()=>({})); alert(err?.message || 'Failed to edit homework'); }
  }
  async function deleteHomework(id) {
    if (!confirm('Delete this homework?')) return;
    const res = await fetch(`${API}/institution/homework/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) loadHomework(); else { const err = await res.json().catch(()=>({})); alert(err?.message || 'Failed to delete homework'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="font-medium">{tasksInline ? 'Tasks' : 'Teacher Dashboard'}</div>
        {loading && <span className="text-xs text-white/80">Loading…</span>}
        {!tasksInline && <button onClick={load} className="ml-auto px-3 py-1 rounded bg-white/20 text-sm">Refresh</button>}
      </div>
      {!tasksInline && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/15 bg-white/10 p-4">
            <div className="font-medium mb-2">Assigned Classes & Subjects</div>
            <div className="text-xs text-white/80 mb-2">{data.teacher?.name} • {data.teacher?.department} • {data.teacher?.designation}</div>
            <div className="mb-3">
              <div className="text-xs text-white/70 mb-1">Classes</div>
              <div className="flex flex-wrap gap-2">
                {(data.assigned?.classes||[]).map((c,i)=>(<span key={i} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">{c}</span>))}
                {(data.assigned?.classes||[]).length===0 && <div className="text-xs text-white/70">No assigned classes yet.</div>}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/70 mb-1">Subjects</div>
              <div className="flex flex-wrap gap-2">
                {(data.assigned?.subjects||[]).map((s,i)=>(<span key={i} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-sm">{s}</span>))}
                {(data.assigned?.subjects||[]).length===0 && <div className="text-xs text-white/70">No subjects listed.</div>}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4">
            <div className="font-medium mb-2">Today's Schedule</div>
            {data.todaySchedule.length===0 ? (
              <div className="text-xs text-white/70">No periods scheduled today.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.todaySchedule||[]).map((r,i)=> (
                      <tr key={i} className="border-t border-white/10">
                        <td className="px-3 py-2">{r.period}</td>
                        <td className="px-3 py-2">{r.subject}</td>
                        <td className="px-3 py-2">{r.classCode}</td>
                        <td className="px-3 py-2">{r.room || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4">
            <div className="font-medium mb-2">Pending Tasks</div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>Attendance to finalize (today)</span>
                <span className="px-2 py-1 rounded bg-white/10 border border-white/20">{data.pending?.attendanceToFinalize || 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Announcements to publish</span>
                <span className="px-2 py-1 rounded bg-white/10 border border-white/20">{data.pending?.announcementsToPublish || 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Report cards to publish</span>
                <span className="px-2 py-1 rounded bg-white/10 border border-white/20">{data.pending?.reportCardsToPublish || 0}</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Removed old Tasks button (now accessible via sidebar as a full page) */}

      {/* Daily Homework & Tasks (inline page when tasksInline=true) */}
      {tasksInline && (
      <div className="rounded-xl border border-white/15 bg-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="font-medium">Daily Homework & Tasks</div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs">Class</label>
            <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={hwClass} onChange={e=>{ setHwClass(e.target.value); loadHomework(e.target.value); }}>
              <option className="text-black" value="">Select class</option>
              {(data.assigned?.classes||[]).map((c,i)=> (<option className="text-black" key={i} value={c}>{c}</option>))}
            </select>
            <button onClick={()=>loadHomework()} className="px-2 py-1 rounded bg-white/20 text-sm">Refresh</button>
          </div>
        </div>

        {/* Create form */}
        <form onSubmit={submitHomework} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input required disabled={!hwClass} placeholder="Subject" className="md:col-span-1 bg-white/10 border border-white/20 rounded px-2 py-1" value={hwForm.subject} onChange={e=>setHwForm(s=>({ ...s, subject: e.target.value }))} />
          <input required disabled={!hwClass} placeholder="Topic" className="md:col-span-1 bg-white/10 border border-white/20 rounded px-2 py-1" value={hwForm.topic} onChange={e=>setHwForm(s=>({ ...s, topic: e.target.value }))} />
          <input disabled={!hwClass} placeholder="Description (optional)" className="md:col-span-2 bg-white/10 border border-white/20 rounded px-2 py-1" value={hwForm.description} onChange={e=>setHwForm(s=>({ ...s, description: e.target.value }))} />
          <input required disabled={!hwClass} type="date" className="md:col-span-1 bg-white/10 border border-white/20 rounded px-2 py-1" value={hwForm.deadline} onChange={e=>setHwForm(s=>({ ...s, deadline: e.target.value }))} />
          <div className="md:col-span-5 flex items-center justify-end">
            <button type="submit" disabled={!hwClass} className="px-3 py-1 rounded bg-indigo-600 text-sm">Create</button>
          </div>
        </form>

        {/* List */}
        <div className="mt-3">
          {hwLoading ? (
            <div className="text-sm text-white/80">Loading…</div>
          ) : hwList.length === 0 ? (
            <div className="text-sm text-white/70">No homework yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Topic</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Deadline</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hwList.map(item => {
                    const canEdit = data.teacher?._id && String(item.createdBy) === String(data.teacher._id) && new Date() <= new Date(item.deadline);
                    return (
                      <tr key={item._id} className="border-t border-white/10">
                        <td className="px-3 py-2">{item.subject}</td>
                        <td className="px-3 py-2">{item.topic}</td>
                        <td className="px-3 py-2 text-white/80 truncate max-w-[300px]">{item.description || '-'}</td>
                        <td className="px-3 py-2">{String(item.deadline||'').slice(0,10)}</td>
                        <td className="px-3 py-2">{item.status}</td>
                        <td className="px-3 py-2 space-x-2">
                          <button disabled={!canEdit} onClick={()=>openHwEdit(item)} className="px-2 py-1 rounded bg-white/20 disabled:opacity-50">Edit</button>
                          <button disabled={!canEdit} onClick={()=>deleteHomework(item._id)} className="px-2 py-1 rounded bg-white/20 disabled:opacity-50">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit modal */}
        {hwEdit.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <form onSubmit={saveHwEdit} className="w-[520px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Edit Homework</div>
                <button type="button" onClick={()=>setHwEdit({ open:false, id:null, data:{} })} className="text-white/70">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input required placeholder="Subject" className="bg-white/10 border border-white/20 rounded px-2 py-1" value={hwEdit.data.subject||''} onChange={e=>setHwEdit(s=>({ ...s, data: { ...s.data, subject: e.target.value } }))} />
                <input required placeholder="Topic" className="bg-white/10 border border-white/20 rounded px-2 py-1" value={hwEdit.data.topic||''} onChange={e=>setHwEdit(s=>({ ...s, data: { ...s.data, topic: e.target.value } }))} />
                <textarea rows={3} placeholder="Description" className="md:col-span-2 bg-white/10 border border-white/20 rounded px-2 py-1" value={hwEdit.data.description||''} onChange={e=>setHwEdit(s=>({ ...s, data: { ...s.data, description: e.target.value } }))} />
                <input required type="date" className="bg-white/10 border border-white/20 rounded px-2 py-1" value={hwEdit.data.deadline||''} onChange={e=>setHwEdit(s=>({ ...s, data: { ...s.data, deadline: e.target.value } }))} />
                <select className="bg-white/10 border border-white/20 rounded px-2 py-1" value={hwEdit.data.status||'Active'} onChange={e=>setHwEdit(s=>({ ...s, data: { ...s.data, status: e.target.value } }))}>
                  {['Active','Closed'].map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={()=>setHwEdit({ open:false, id:null, data:{} })} className="px-3 py-2 rounded bg-white/10">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-indigo-600">Save</button>
              </div>
            </form>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ------- Mentor Timetable (Teacher view) -------
function MentorTimetable({ token }) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classCode, setClassCode] = useState("");
  const [tt, setTt] = useState({ entries: [], loading: false, error: "" });

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const PERIODS = ['P1','P2','P3','P4','P5','P6','P7','P8'];

  async function loadAssigned() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/institution/teacher/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) {
        const cls = Array.isArray(d?.assigned?.classes) ? d.assigned.classes : [];
        setClasses(cls);
        if (!classCode && cls.length > 0) setClassCode(cls[0]);
      }
    } finally { setLoading(false); }
  }

  async function loadTimetable(code) {
    const cc = code || classCode;
    if (!cc) return;
    setTt(s => ({ ...s, loading: true, error: "" }));
    try {
      const r = await fetch(`${API}/institution/timetable/${encodeURIComponent(cc)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(()=>({entries:[]}));
      if (!r.ok) throw new Error(d?.message || 'Failed to load timetable');
      setTt({ entries: Array.isArray(d.entries) ? d.entries : [], loading: false, error: "" });
    } catch (e) {
      setTt({ entries: [], loading: false, error: e.message || 'Failed to load timetable' });
    }
  }

  useEffect(()=>{ loadAssigned(); }, []);
  useEffect(()=>{ if (classCode) loadTimetable(classCode); }, [classCode]);

  // Build a Day x Period grid for display
  const grid = useMemo(() => {
    const g = {};
    for (let d = 0; d <= 6; d++) g[d] = {};
    for (const e of (tt.entries||[])) {
      const day = Number(e.dayOfWeek);
      const p = String(e.period);
      g[day] = g[day] || {};
      g[day][p] = g[day][p] || [];
      g[day][p].push(e);
    }
    return g;
  }, [tt.entries]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="font-medium">Class Timetable</div>
        {(loading || tt.loading) && <span className="text-xs text-white/80">Loading…</span>}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs">Class</label>
          <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={classCode} onChange={e=>setClassCode(e.target.value)}>
            <option className="text-black" value="">Select class</option>
            {classes.map((c,i)=> (<option className="text-black" key={i} value={c}>{c}</option>))}
          </select>
          <button onClick={()=>{ loadAssigned(); if(classCode) loadTimetable(); }} className="px-2 py-1 rounded bg-white/20 text-sm">Refresh</button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-sm text-white/80">No classes assigned yet. Once an admin assigns you to a class, you'll see the timetable here.</div>
      ) : !classCode ? (
        <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-sm text-white/80">Select a class to view its timetable.</div>
      ) : tt.error ? (
        <div className="rounded-xl border border-rose-400/50 bg-rose-900/30 p-4 text-sm">{tt.error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/15 bg-white/10">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2">Day</th>
                {PERIODS.map(p=> <th key={p} className="px-3 py-2">{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {[0,1,2,3,4,5,6].map(d => (
                <tr key={d} className="border-t border-white/10 align-top">
                  <td className="px-3 py-2 font-medium text-white/90">{DAY_LABELS[d]}</td>
                  {PERIODS.map(p => {
                    const cell = (grid?.[d]?.[p]) || [];
                    return (
                      <td key={p} className="px-3 py-2">
                        {cell.length === 0 ? (
                          <span className="text-white/50">—</span>
                        ) : (
                          <div className="space-y-1">
                            {cell.map((e, i) => (
                              <div key={e._id||i} className="rounded bg-white/10 border border-white/20 px-2 py-1">
                                <div className="font-medium">{e.subject || '—'}</div>
                                <div className="text-xs text-white/70">Room {e.room || '-'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------- Teachers Management (School Admin) -------
function SchoolAdminTeachers({ token }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [pay, setPay] = useState({ open: false, id: null, data: { amount: 0, method: "Cash", receiptNo: "", notes: "", month: new Date().getMonth()+1, year: new Date().getFullYear(), date: new Date().toISOString().slice(0,10) } });
  const [verify, setVerify] = useState({ open: false, id: null, verified: true, notes: "" });
  const [att, setAtt] = useState({ open: false, id: null, month: new Date().getMonth()+1, year: new Date().getFullYear(), summary: null, loading: false });
  const [resetPwd, setResetPwd] = useState({ open: false, id: null, name: '', password: '', saving: false, error: '' });
  // Row actions menu and credentials modal
  const [menuFor, setMenuFor] = useState(null); // teacher id whose action menu is open
  const [cred, setCred] = useState({ open:false, id:null, name:'', username:'', changedAt:null, newPassword:'', loading:false, error:'', showReset:false, showCurrent:false });
  // Add Teacher/Mentor wizard state (now supports adding Mentors with login credentials)
  const [addT, setAddT] = useState({
    open: false,
    step: 1,
    data: {
      name: '',
      email: '',
      phone: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      monthlySalary: 0,
      department: '',
      subjects: [],
      classes: [],
      // New: role selector and mentor-only fields
      role: 'Teacher',
      mentorshipAreas: '',
      auth: { username: '' },
      password: '',
      // Class teacher and timetable
      isClassTeacher: false,
      classTeacherClass: '',
      classTeacherSection: '',
      timetable: []
    }
  });
  // Timetable row editing index (for UX: edit per-row, delete from bottom)
  const [editIdx, setEditIdx] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const usp = new URLSearchParams();
      if (q) usp.set('q', q);
      // Correct endpoint: School Admin teachers list
      const res = await fetch(`${API}/school/teachers?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      // Fallback: If portal route filters differ, load payroll list to ensure salary fields
      let teachers = data?.teachers || [];
      if (!Array.isArray(teachers) || teachers.length === 0 || teachers[0]?.salary == null) {
        // Correct endpoint: School Admin teachers payroll
        const res2 = await fetch(`${API}/school/teachers/payroll`, { headers: { Authorization: `Bearer ${token}` } });
        const d2 = await res2.json();
        if (res2.ok) teachers = d2.teachers || teachers;
      }
      setRows(teachers);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []);

  function openPay(r) { setPay({ open: true, id: r.id || r._id, data: { amount: 0, method: 'Cash', receiptNo: '', notes: '', month: new Date().getMonth()+1, year: new Date().getFullYear(), date: new Date().toISOString().slice(0,10) } }); }
  async function submitPay(e) {
    e.preventDefault();
    const payload = { ...pay.data, amount: Number(pay.data.amount || 0) };
    // Correct endpoint: record salary payment
    const res = await fetch(`${API}/school/teachers/${pay.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) { setPay({ open: false, id: null, data: pay.data }); load(); }
  }

  function openVerify(r) { setVerify({ open: true, id: r.id || r._id, verified: !!r.backgroundVerified, notes: '' }); }
  async function submitVerify(e) {
    e.preventDefault();
    const payload = { verified: !!verify.verified, notes: verify.notes };
    // Correct endpoint: toggle background verification
    const res = await fetch(`${API}/school/teachers/${verify.id}/background-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) { setVerify({ open: false, id: null, verified: true, notes: '' }); load(); }
  }

  function openAttendance(r) { setAtt({ open: true, id: r.id || r._id, month: new Date().getMonth()+1, year: new Date().getFullYear(), summary: null, loading: true }); loadAttendanceSummary(r.id || r._id, new Date().getFullYear(), new Date().getMonth()+1); }
  function openResetPassword(r) { setResetPwd({ open: true, id: r.id || r._id, name: r.name, password: '', saving: false, error: '' }); }
  async function submitResetPassword(e) {
    e.preventDefault();
    if (!resetPwd.password || resetPwd.password.length < 6) {
      setResetPwd(s => ({ ...s, error: 'Please enter a new password (min 6 chars)' }));
      return;
    }
    try {
      setResetPwd(s => ({ ...s, saving: true, error: '' }));
      const res = await fetch(`${API}/school/teachers/${resetPwd.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: resetPwd.password })
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        throw new Error(d?.message || 'Failed to reset password');
      }
      setResetPwd({ open: false, id: null, name: '', password: '', saving: false, error: '' });
      load();
    } catch (e) {
      setResetPwd(s => ({ ...s, saving: false, error: e.message || 'Failed to reset password' }));
    }
  }

  async function openCredentials(r){
    try{
      setCred(s=>({ ...s, open:true, id:r.id||r._id, name:r.name, username:'', changedAt:null, newPassword:'', loading:true, error:'', showReset:false, showCurrent:false }));
      const res = await fetch(`${API}/school/teachers/${r.id||r._id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if(!res.ok) throw new Error(d?.message || 'Failed to load credentials');
      const t = d.teacher || {};
      setCred(s=>({ ...s, loading:false, username: t?.auth?.username || '', changedAt: t?.passwordChangedAt || null }));
    } catch(e){
      setCred(s=>({ ...s, loading:false, error: e.message || 'Failed to load credentials' }));
    }
  }

  async function saveCredPassword(e){
    e.preventDefault();
    if(!cred.newPassword || cred.newPassword.length < 6){
      setCred(s=>({ ...s, error: 'Please enter a new password (min 6 chars)' }));
      return;
    }
    try{
      setCred(s=>({ ...s, loading:true, error:'' }));
      const res = await fetch(`${API}/school/teachers/${cred.id}/`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ password: cred.newPassword })
      });
      const d = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(d?.message || 'Failed to reset password');
      setCred(s=>({ ...s, newPassword:'', loading:false, changedAt: new Date().toISOString() }));
      load();
    }catch(e){
      setCred(s=>({ ...s, loading:false, error: e.message || 'Failed to reset password' }));
    }
  }
  async function loadAttendanceSummary(id, year, month) {
    setAtt(s => ({ ...s, loading: true }));
    // Correct endpoint: monthly attendance summary
    const res = await fetch(`${API}/school/teachers/${id}/attendance-summary?year=${year}&month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setAtt(s => ({ ...s, summary: data.summary, loading: false, year: data.year, month: data.month }));
    else setAtt(s => ({ ...s, loading: false }));
  }
  async function recordAttendance(status) {
    // Correct endpoint: record teacher attendance for a date
    const res = await fetch(`${API}/school/teachers/${att.id}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ date: new Date().toISOString().slice(0,10), status }) });
    if (res.ok) loadAttendanceSummary(att.id, att.year, att.month);
  }

  // ---- Add Teacher Wizard helpers ----
  // Predefined day slots with breaks and class hours
  const TIME_SLOTS = [
    { value: '09:00-10:00', label: '9:00 – 10:00', type: 'Class' },
    { value: '10:00-11:00', label: '10:00 – 11:00', type: 'Class' },
    { value: '11:00-11:30', label: '11:00 – 11:30 (Break)', type: 'Break' },
    { value: '11:30-12:30', label: '11:30 – 12:30', type: 'Class' },
    { value: '13:30-14:30', label: '1:30 – 2:30', type: 'Class' },
    { value: '14:30-15:30', label: '2:30 – 3:30', type: 'Class' },
    { value: '15:30-16:30', label: '3:30 – 4:30', type: 'Class' },
    { value: '14:30-16:30', label: '2:30 – 4:30 (Break)', type: 'Break' },
  ];
  function addEntry(){
    setAddT(s=>({ ...s, data: { ...s.data, timetable: [...(s.data.timetable||[]), { day:'Mon', slot:'09:00-10:00', period:1, classLevel:'', section:'', subject:'' }] } }));
  }
  function updateEntry(i, field, value){
    setAddT(s=>({ ...s, data: { ...s.data, timetable: (s.data.timetable||[]).map((e,idx)=> idx===i ? { ...e, [field]: value } : e ) } }));
  }
  function removeEntry(i){
    setAddT(s=>({ ...s, data: { ...s.data, timetable: (s.data.timetable||[]).filter((_,idx)=> idx!==i) } }));
  }
  function timetableError(entries){
    const seenTeacher = new Set();
    const seenClass = new Set();
    for(const e of entries||[]){
      const keyT = `${e.day}-${e.slot || e.period}`;
      if(seenTeacher.has(keyT)) return 'Overlapping period for the same teacher.';
      seenTeacher.add(keyT);
      if(e.classLevel && e.section){
        const keyC = `${e.day}-${e.slot || e.period}-${e.classLevel}-${e.section}`;
        if(seenClass.has(keyC)) return 'Overlapping period for the same class & section.';
        seenClass.add(keyC);
      }
    }
    return '';
  }
  function canSaveTeacher(){
    const d = addT.data;
    if(!d.name || !d.email || !/^\d{10}$/.test(d.phone)) return false;
    if(!d.department) return false;
    if(timetableError(d.timetable)) return false;
    return true;
  }
  function genEmployeeId(){
    const yr = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random()*9000);
    return `EMP-${yr}-${rand}`;
  }
  async function saveTeacher(){
    const d = addT.data;
    const payload = {
      name: d.name,
      email: d.email,
      phone: d.phone,
      employeeId: genEmployeeId(),
      department: d.department,
      designation: d.role === 'Mentor' ? 'Mentor' : 'Teacher',
      subjects: d.subjects,
      classes: d.classes,
      joiningDate: d.joiningDate,
      role: d.role,
      // Monthly salary in salary.monthlySalary via update after create
    };
    // When adding a Mentor, include mentorship areas and login credentials, require both
    if (d.role === 'Mentor') {
      const hasU = (d.auth?.username || '').trim().length > 0;
      const hasP = (d.password || '').trim().length > 0;
      if (!hasU || !hasP) {
        alert('Mentor login requires both username and password');
        return;
      }
      payload.mentorshipAreas = (d.mentorshipAreas || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      payload.auth = { username: (d.auth?.username || '').trim() };
      payload.password = d.password;
    }
    // For Teachers, credentials are optional but must be provided together
    if (d.role !== 'Mentor') {
      const hasU = (d.auth?.username || '').trim().length > 0;
      const hasP = (d.password || '').trim().length > 0;
      if ((hasU && !hasP) || (!hasU && hasP)) {
        alert('To set Teacher login, provide both username and password');
        return;
      }
      if (hasU && hasP) {
        payload.auth = { username: (d.auth?.username || '').trim() };
        payload.password = d.password;
      }
    }
    try{
      const res = await fetch(`${API}/school/teachers`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>({}));
      if(res.ok){
        // Update salary if provided
        if(Number(d.monthlySalary||0)>0){
          await fetch(`${API}/school/teachers/${data.teacher?._id||data.teacher?.id}/`, { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ salary: { monthlySalary: Number(d.monthlySalary) } }) });
        }
        // Reset wizard
        setAddT({ open:false, step:1, data: {
          ...addT.data,
          name:'', email:'', phone:'', department:'', subjects:[], classes:[],
          role:'Teacher', mentorshipAreas:'', auth:{ username:'' }, password:'',
          isClassTeacher:false, classTeacherClass:'', classTeacherSection:'', timetable:[],
        } });
        load();
      } else {
        alert(data?.message || 'Failed to add teacher');
      }
    } catch {
      alert('Failed to add teacher');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name/email/employeeId" className="bg-white/10 border border-white/20 rounded px-3 py-1 text-sm" />
        <button onClick={load} className="px-3 py-1 rounded bg-white/20 text-sm">Search</button>
        {loading && <span className="text-xs text-white/80">Loading…</span>}
        <button onClick={()=>setAddT(s=>({ ...s, open:true, step:1 }))} className="ml-auto px-3 py-1 rounded bg-indigo-600 text-sm">Add Teacher</button>
      </div>
      <div className="rounded-xl border border-white/15 bg-white/10 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Employee ID</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Subjects</th>
              <th className="px-3 py-2">Classes</th>
              <th className="px-3 py-2">Joining</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2">Monthly Salary</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Login</th>
              <th className="px-3 py-2">Pwd Changed</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id || r._id} className="border-t border-white/10">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-white/80">{r.employeeId}</td>
                <td className="px-3 py-2">{r.department}</td>
                <td className="px-3 py-2 text-white/80">{Array.isArray(r.subjects)? r.subjects.join(', ') : ''}</td>
                <td className="px-3 py-2 text-white/80">{Array.isArray(r.classes)? r.classes.join(', ') : ''}</td>
                <td className="px-3 py-2 text-white/80">{r.joiningDate? String(r.joiningDate).slice(0,10): '-'}</td>
                <td className="px-3 py-2">{r.backgroundVerified? 'Yes':'No'}</td>
                <td className="px-3 py-2">₹{Number(r.salary?.monthlySalary||0)}</td>
                <td className="px-3 py-2">₹{Number(r.salary?.paidAmount||0)}</td>
                <td className="px-3 py-2">{r?.auth?.username ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 text-white/80">{r.passwordChangedAt ? String(r.passwordChangedAt).slice(0,10) : '-'}</td>
                <td className="px-3 py-2">{r.salary?.status || 'Pending'}</td>
                <td className="px-3 py-2">
                  <a href={`/institution/teacher/${r.id||r._id}`} className="px-2 py-1 rounded bg-white/20 inline-block">Actions</a>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-white/70">No teachers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Add/Manage Teacher Wizard */}
      {addT.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-[760px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{addT.step===4? 'Manage Timetable' : 'Add Teacher'}</div>
              <button type="button" onClick={()=>setAddT({ open:false, step:1, data: addT.data })} className="text-white/70">✕</button>
            </div>
            <div className="flex gap-2 mb-3">
              {["Basic Info","Academic","Class Teacher","Timetable"].map((label, idx)=> (
                <div key={label} className={`px-2 py-1 rounded text-xs border ${addT.step===idx+1? 'bg-white/10':''}`}>{idx+1}. {label}</div>
              ))}
            </div>
            {addT.step===1 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Full Name</label>
                  <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.name} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, name: e.target.value } }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Email</label>
                  <input type="email" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.email} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, email: e.target.value } }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Phone</label>
                  <input inputMode="numeric" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.phone} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, phone: e.target.value.replace(/\D/g,'').slice(0,10) } }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Joining Date</label>
                  <input type="date" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.joiningDate||''} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, joiningDate: e.target.value } }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Role</label>
                  <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.role} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, role: e.target.value } }))}>
                    <option className="text-black" value="Teacher">Teacher</option>
                    <option className="text-black" value="Mentor">Mentor</option>
                  </select>
                </div>
                {/* Credentials moved to Step 4 (after Timetable), available for both Teacher and Mentor */}
                <div className="col-span-2">
                  <label className="block text-xs mb-1">Monthly Salary (₹)</label>
                  <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.monthlySalary} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, monthlySalary: Number(e.target.value)||0 } }))} />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button onClick={()=>setAddT(s=>({ ...s, step:2 }))} className="px-3 py-1 rounded bg-indigo-600">Next</button>
                </div>
              </div>
            )}
            {addT.step===2 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1">Department</label>
                  <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.department} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, department: e.target.value } }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Subjects (comma-separated)</label>
                  <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.subjects.join(', ')} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, subjects: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) } }))} />
                </div>
                {addT.data.role === 'Mentor' && (
                  <div>
                    <label className="block text-xs mb-1">Mentorship Areas (comma-separated)</label>
                    <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.mentorshipAreas} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, mentorshipAreas: e.target.value } }))} />
                  </div>
                )}
                <div>
                  <label className="block text-xs mb-1">Classes (multi-select)</label>
                  <div className="flex flex-wrap gap-1">
                    {["LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"].map(c=> (
                      <button type="button" key={c} onClick={()=>setAddT(s=>({ ...s, data: { ...s.data, classes: s.data.classes.includes(c)? s.data.classes.filter(x=>x!==c) : [...s.data.classes, c] } }))} className={`px-2 py-1 rounded border text-xs ${addT.data.classes.includes(c)? 'bg-white/10' : 'bg-white/5'}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={()=>setAddT(s=>({ ...s, step:1 }))} className="px-3 py-1 rounded bg-white/10">Back</button>
                  <button onClick={()=>setAddT(s=>({ ...s, step:3 }))} className="px-3 py-1 rounded bg-indigo-600">Next</button>
                </div>
              </div>
            )}
            {addT.step===3 && (
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={addT.data.isClassTeacher} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, isClassTeacher: e.target.checked } }))} /> Class Teacher</label>
                {addT.data.isClassTeacher && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Class</label>
                      <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.classTeacherClass} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, classTeacherClass: e.target.value } }))}>
                        <option className="text-black" value="">Select</option>
                        {["LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"].map(c=> <option className="text-black" key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Section</label>
                      <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.classTeacherSection} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, classTeacherSection: e.target.value } }))}>
                        <option className="text-black" value="">Select</option>
                        {["A","B","C","D","E"].map(s=> <option className="text-black" key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {/* Inline enforcement note */}
                {addT.data.isClassTeacher && (!addT.data.classTeacherClass || !addT.data.classTeacherSection) && (
                  <div className="text-[11px] text-yellow-200/90">Select one class and section. System enforces one class→one class teacher.</div>
                )}
                <div className="flex items-center justify-between">
                  <button onClick={()=>setAddT(s=>({ ...s, step:2 }))} className="px-3 py-1 rounded bg-white/10">Back</button>
                  <button onClick={()=>setAddT(s=>({ ...s, step:4 }))} className="px-3 py-1 rounded bg-indigo-600">Next</button>
                </div>
              </div>
            )}
            {addT.step===4 && (
              <div className="space-y-3">
                <div className="text-sm">Timetable Entries (Academic year specific)</div>
                <div className="space-y-2">
                  {(addT.data.timetable||[]).map((e,i)=> (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <select className="col-span-2 bg-white/10 border border-white/20 rounded px-2 py-1" value={e.day||''} onChange={ev=>updateEntry(i,'day',ev.target.value)}>
                        {['Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <option className="text-black" key={d} value={d}>{d}</option>)}
                      </select>
                      <input type="number" min={1} className="col-span-2 bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Period" value={e.period||''} onChange={ev=>updateEntry(i,'period',Number(ev.target.value)||'' )} />
                      <select className="col-span-2 bg-white/10 border border-white/20 rounded px-2 py-1" value={e.classLevel||''} onChange={ev=>updateEntry(i,'classLevel',ev.target.value)}>
                        <option className="text-black" value="">Class</option>
                        {["LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"].map(c=> <option className="text-black" key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="col-span-2 bg-white/10 border border-white/20 rounded px-2 py-1" value={e.section||''} onChange={ev=>updateEntry(i,'section',ev.target.value)}>
                        <option className="text-black" value="">Section</option>
                        {["A","B","C","D","E"].map(s=> <option className="text-black" key={s} value={s}>{s}</option>)}
                      </select>
                      <input className="col-span-3 bg-white/10 border border-white/20 rounded px-2 py-1" placeholder="Subject" value={e.subject||''} onChange={ev=>updateEntry(i,'subject',ev.target.value)} />
                      <button type="button" onClick={()=>removeEntry(i)} className="col-span-1 px-2 py-1 rounded bg-white/10">Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={()=>addEntry()} className="px-3 py-1 rounded bg-white/20 text-sm">Add Entry</button>
                </div>
                {timetableError(addT.data.timetable) && (
                  <div className="text-[11px] text-yellow-200/90">{timetableError(addT.data.timetable)}</div>
                )}
                {/* Account Credentials (after timetable) */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Account Credentials</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Login Username {addT.data.role==='Mentor' && <span className="text-red-300">*</span>}</label>
                      <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.auth.username} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, auth: { username: e.target.value } } }))} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Initial Password {addT.data.role==='Mentor' && <span className="text-red-300">*</span>}</label>
                      <input type="password" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={addT.data.password} onChange={e=>setAddT(s=>({ ...s, data: { ...s.data, password: e.target.value } }))} />
                    </div>
                  </div>
                  {addT.data.role !== 'Mentor' && (
                    <div className="text-[11px] text-white/70">Optional for Teachers. Provide both username and password to enable login.</div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={()=>setAddT(s=>({ ...s, step:3 }))} className="px-3 py-1 rounded bg-white/10">Back</button>
                  <div className="space-x-2">
                    <button type="button" onClick={()=>{ if(editIdx!==null) { removeEntry(editIdx); setEditIdx(null); } }} className="px-3 py-1 rounded bg-red-600/70" disabled={editIdx===null}>Delete Selected</button>
                    <button onClick={saveTeacher} className="px-3 py-1 rounded bg-indigo-600" disabled={!canSaveTeacher()}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {pay.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <form onSubmit={submitPay} className="w-[520px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Record Salary Payment</div>
              <button type="button" onClick={()=>setPay({ open:false, id:null, data: pay.data })} className="text-white/70">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Amount (₹)</label>
                <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.amount} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, amount: Number(e.target.value)||0 } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Method</label>
                <select className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.method} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, method: e.target.value } }))}>
                  {['Cash','UPI','Bank','Cheque','Other'].map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Receipt No</label>
                <input className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.receiptNo} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, receiptNo: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Date</label>
                <input type="date" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.date||''} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, date: e.target.value } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Month</label>
                <input type="number" min={1} max={12} className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.month} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, month: Number(e.target.value)||1 } }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Year</label>
                <input type="number" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.year} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, year: Number(e.target.value)||new Date().getFullYear() } }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1">Notes</label>
                <textarea rows={3} className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={pay.data.notes} onChange={e=>setPay(s=>({ ...s, data: { ...s.data, notes: e.target.value } }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setPay({ open:false, id:null, data: pay.data })} className="px-3 py-2 rounded bg-white/10">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600">Save Payment</button>
            </div>
          </form>
        </div>
      )}

      {/* Verification Modal */}
      {verify.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <form onSubmit={submitVerify} className="w-[520px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Background Verification</div>
              <button type="button" onClick={()=>setVerify({ open:false, id:null, verified:true, notes:'' })} className="text-white/70">✕</button>
            </div>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={verify.verified} onChange={e=>setVerify(s=>({ ...s, verified: e.target.checked }))} /> Verified</label>
              <div>
                <label className="block text-xs mb-1">Notes</label>
                <textarea rows={3} className="w-full bg-white/10 border border-white/20 rounded px-2 py-1" value={verify.notes} onChange={e=>setVerify(s=>({ ...s, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setVerify({ open:false, id:null, verified:true, notes:'' })} className="px-3 py-2 rounded bg-white/10">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Attendance Modal */}
      {att.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-[560px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Attendance Summary</div>
              <button type="button" onClick={()=>setAtt({ open:false, id:null, month: att.month, year: att.year, summary: null, loading: false })} className="text-white/70">✕</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Month</label>
              <input type="number" min={1} max={12} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={att.month} onChange={e=>loadAttendanceSummary(att.id, att.year, Number(e.target.value)||att.month)} />
              <label className="text-sm">Year</label>
              <input type="number" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={att.year} onChange={e=>loadAttendanceSummary(att.id, Number(e.target.value)||att.year, att.month)} />
              {att.loading && <span className="text-xs text-white/80">Loading…</span>}
              <div className="ml-auto space-x-2">
                <button onClick={()=>recordAttendance('Present')} className="px-2 py-1 rounded bg-white/20">Mark Present</button>
                <button onClick={()=>recordAttendance('Absent')} className="px-2 py-1 rounded bg-white/20">Mark Absent</button>
              </div>
            </div>
            {att.summary ? (
              <div className="grid grid-cols-4 gap-3">
                {['Present','Absent','Late','Excused'].map(k=> (
                  <div key={k} className="rounded-xl border border-white/15 bg-white/10 p-4 text-center">
                    <div className="text-2xl font-semibold">{att.summary[k]||0}</div>
                    <div className="text-xs text-white/80 mt-1">{k}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/80">No attendance yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {cred.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="w-[520px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Credentials</div>
              <button type="button" onClick={()=>setCred({ open:false, id:null, name:'', username:'', changedAt:null, newPassword:'', loading:false, error:'', showReset:false, showCurrent:false })} className="text-white/70">✕</button>
            </div>
            {cred.error && <div className="text-red-200 text-xs">{cred.error}</div>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-white/70 text-xs mb-1">Name</div>
                <div className="font-medium">{cred.name}</div>
              </div>
              <div>
                <div className="text-white/70 text-xs mb-1">Username</div>
                <div className="font-medium">{cred.username || '-'}</div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-xs mb-1">Current Password</div>
                  <button type="button" className="text-xs text-white/80 hover:text-white" onClick={()=>setCred(s=>({ ...s, showCurrent: !s.showCurrent }))} title={cred.showCurrent ? 'Hide' : 'Show'}>
                    {cred.showCurrent ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="font-medium">
                  {cred.showCurrent ? 'Not retrievable' : '••••••••'}
                  <span className="text-white/60 text-xs align-middle"> (hashed; cannot display)</span>
                </div>
              </div>
              <div>
                <div className="text-white/70 text-xs mb-1">Password Changed</div>
                <div className="font-medium">{cred.changedAt ? String(cred.changedAt).slice(0,10) : '-'}</div>
              </div>
            </div>
            <form onSubmit={saveCredPassword} className="space-y-2">
              <div>
                <label className="block text-xs mb-1">Reset Password</label>
                <div className="relative">
                  <input type={cred.showReset ? 'text' : 'password'} className="w-full bg-white/10 border border-white/20 rounded px-2 py-2 pr-10" value={cred.newPassword} onChange={e=>setCred(s=>({ ...s, newPassword: e.target.value }))} />
                  <button type="button" onClick={()=>setCred(s=>({ ...s, showReset: !s.showReset }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/80 hover:text-white" title={cred.showReset ? 'Hide password' : 'Show password'}>
                    {cred.showReset ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="text-[11px] text-white/60 mt-1">Min 6 characters.</div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={()=>setCred({ open:false, id:null, name:'', username:'', changedAt:null, newPassword:'', loading:false, error:'', showReset:false, showCurrent:false })} className="px-3 py-2 rounded bg-white/10">Close</button>
                <button type="submit" disabled={cred.loading} className="px-3 py-2 rounded bg-indigo-600">{cred.loading ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwd.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <form onSubmit={submitResetPassword} className="w-[460px] max-w-[95vw] rounded-xl bg-slate-900/90 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Reset Password</div>
              <button type="button" onClick={()=>setResetPwd({ open:false, id:null, name:'', password:'', saving:false, error:'' })} className="text-white/70">✕</button>
            </div>
            <div className="text-sm text-white/80">Set a new password for <span className="font-semibold text-white">{resetPwd.name}</span>.</div>
            {resetPwd.error && <div className="text-red-200 text-xs">{resetPwd.error}</div>}
            <div>
              <label className="block text-xs mb-1">New Password</label>
              <input type="password" className="w-full bg-white/10 border border-white/20 rounded px-2 py-2" value={resetPwd.password} onChange={e=>setResetPwd(s=>({ ...s, password: e.target.value }))} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setResetPwd({ open:false, id:null, name:'', password:'', saving:false, error:'' })} className="px-3 py-2 rounded bg-white/10">Cancel</button>
              <button type="submit" disabled={resetPwd.saving} className="px-3 py-2 rounded bg-indigo-600">{resetPwd.saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ------- Trustees & Contributions (School Admin) -------
function SchoolAdminTrustees({ token }) {
  const [trustees, setTrustees] = useState([]);
  const [cons, setCons] = useState([]);
  const [filter, setFilter] = useState({ sourceType: '', type: '' });
  const [modal, setModal] = useState({ open: false, editId: null, data: {} });
  const [cModal, setCModal] = useState({ open: false, editId: null, data: {} });

  async function loadTrustees() {
    const res = await fetch(`${API}/school/trustees`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setTrustees(data.trustees || []);
  }
  async function loadContributions() {
    const qs = new URLSearchParams();
    if (filter.sourceType) qs.set('sourceType', filter.sourceType);
    if (filter.type) qs.set('type', filter.type);
    const res = await fetch(`${API}/school/contributions?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setCons(data.contributions || []);
  }
  useEffect(()=>{ loadTrustees(); },[]);
  useEffect(()=>{ loadContributions(); },[filter]);

  async function saveTrustee() {
    const payload = modal.data;
    const isEdit = !!modal.editId;
    const url = isEdit ? `${API}/school/trustees/${modal.editId}` : `${API}/school/trustees`;
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) { setModal({ open: false, editId: null, data: {} }); loadTrustees(); }
  }
  async function deleteTrustee(id) {
    if (!confirm('Delete trustee?')) return;
    const res = await fetch(`${API}/school/trustees/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) loadTrustees();
  }
  async function saveContribution() {
    const payload = cModal.data;
    const isEdit = !!cModal.editId;
    const url = isEdit ? `${API}/school/contributions/${cModal.editId}` : `${API}/school/contributions`;
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) { setCModal({ open: false, editId: null, data: {} }); loadContributions(); }
  }
  async function deleteContribution(id) {
    if (!confirm('Delete contribution?')) return;
    const res = await fetch(`${API}/school/contributions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) loadContributions();
  }

  return (
    <div className="space-y-4">
      {/* Trustees */}
      <div className="rounded-xl border border-white/15 bg-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-medium">Trustee list</div>
          <button onClick={()=>setModal({ open: true, editId: null, data: { name:'', title:'', sinceYear:'', contactEmail:'', contactPhone:'', bio:'', notes:'', involvement:{} } })} className="px-3 py-1 rounded bg-white/20 text-sm">Add Trustee</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Since</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">District/NGO</th><th className="px-3 py-2">Actions</th></tr></thead>
            <tbody>
              {trustees.map(t => (
                <tr key={t._id} className="border-t border-white/10">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-white/80">{t.title||'-'}</td>
                  <td className="px-3 py-2 text-white/80">{t.sinceYear||'-'}</td>
                  <td className="px-3 py-2 text-white/80">{[t.contactEmail,t.contactPhone].filter(Boolean).join(' | ')||'-'}</td>
                  <td className="px-3 py-2 text-white/80">{t?.involvement?.district? (t?.involvement?.districtName||'District') : ''} {t?.involvement?.ngo? (' | '+(t?.involvement?.ngoName||'NGO')):''}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={()=>setModal({ open:true, editId: t._id, data: t })} className="px-2 py-1 rounded bg-white/20">Edit</button>
                    <button onClick={()=>deleteTrustee(t._id)} className="px-2 py-1 rounded bg-white/20">Delete</button>
                  </td>
                </tr>
              ))}
              {trustees.length===0 && (<tr><td colSpan={6} className="px-3 py-6 text-center text-white/70">No trustees yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contributions */}
      <div className="rounded-xl border border-white/15 bg-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-medium">Contributions</div>
          <div className="flex items-center gap-2">
            <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={filter.sourceType} onChange={e=>setFilter(f=>({ ...f, sourceType: e.target.value }))}>
              <option value="">All sources</option>
              <option>Trustee</option>
              <option>District</option>
              <option>NGO</option>
              <option>Other</option>
            </select>
            <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={filter.type} onChange={e=>setFilter(f=>({ ...f, type: e.target.value }))}>
              <option value="">All types</option>
              <option>Financial</option>
              <option>Resource</option>
            </select>
            <button onClick={()=>setCModal({ open:true, editId:null, data: { sourceType:'Trustee', type:'Financial', amount:'', resourceDescription:'', sourceName:'', notes:'', date: new Date().toISOString().slice(0,10) } })} className="px-3 py-1 rounded bg-white/20 text-sm">Add Contribution</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Amount/Resource</th><th className="px-3 py-2">Notes</th><th className="px-3 py-2">Actions</th></tr></thead>
            <tbody>
              {cons.map(c => (
                <tr key={c._id} className="border-t border-white/10">
                  <td className="px-3 py-2 text-white/80">{c.date? String(c.date).slice(0,10): '-'}</td>
                  <td className="px-3 py-2">{c.sourceType}{c.sourceName? ` - ${c.sourceName}`:''}</td>
                  <td className="px-3 py-2">{c.type}</td>
                  <td className="px-3 py-2 text-white/80">{c.type==='Financial'? (c.amount!=null? c.amount : '-') : (c.resourceDescription || '-')}</td>
                  <td className="px-3 py-2 text-white/80">{c.notes || '-'}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={()=>setCModal({ open:true, editId:c._id, data: { ...c, date: c.date? String(c.date).slice(0,10): '' } })} className="px-2 py-1 rounded bg-white/20">Edit</button>
                    <button onClick={()=>deleteContribution(c._id)} className="px-2 py-1 rounded bg-white/20">Delete</button>
                  </td>
                </tr>
              ))}
              {cons.length===0 && (<tr><td colSpan={6} className="px-3 py-6 text-center text-white/70">No contributions yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trustee modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="w-[600px] rounded-xl border border-white/15 bg-slate-900 p-4 space-y-2">
            <div className="font-medium">{modal.editId? 'Edit Trustee' : 'Add Trustee'}</div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Name" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data.name||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, name: e.target.value } }))} />
              <input placeholder="Title" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data.title||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, title: e.target.value } }))} />
              <input placeholder="Since Year" type="number" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data.sinceYear||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, sinceYear: e.target.value } }))} />
              <input placeholder="Contact Email" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data.contactEmail||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, contactEmail: e.target.value } }))} />
              <input placeholder="Contact Phone" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data.contactPhone||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, contactPhone: e.target.value } }))} />
              <input placeholder="Photo URL" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data.photoUrl||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, photoUrl: e.target.value } }))} />
            </div>
            <textarea placeholder="Bio" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full" rows={3} value={modal.data.bio||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, bio: e.target.value } }))}></textarea>
            <textarea placeholder="Notes/remarks" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full" rows={2} value={modal.data.notes||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, notes: e.target.value } }))}></textarea>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm"><input type="checkbox" className="mr-2" checked={!!modal.data?.involvement?.district} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, involvement: { ...(m.data.involvement||{}), district: e.target.checked } } }))} /> District involvement</label>
              <input placeholder="District Name" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data?.involvement?.districtName||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, involvement: { ...(m.data.involvement||{}), districtName: e.target.value } } }))} />
              <label className="text-sm"><input type="checkbox" className="mr-2" checked={!!modal.data?.involvement?.ngo} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, involvement: { ...(m.data.involvement||{}), ngo: e.target.checked } } }))} /> NGO involvement</label>
              <input placeholder="NGO Name" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data?.involvement?.ngoName||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, involvement: { ...(m.data.involvement||{}), ngoName: e.target.value } } }))} />
              <input placeholder="Org Name" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={modal.data?.involvement?.orgName||''} onChange={e=>setModal(m=>({ ...m, data: { ...m.data, involvement: { ...(m.data.involvement||{}), orgName: e.target.value } } }))} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={()=>setModal({ open:false, editId:null, data:{} })} className="px-3 py-1 rounded bg-white/10 text-sm">Cancel</button>
              <button onClick={saveTrustee} className="px-3 py-1 rounded bg-indigo-600 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Contribution modal */}
      {cModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="w-[600px] rounded-xl border border-white/15 bg-slate-900 p-4 space-y-2">
            <div className="font-medium">{cModal.editId? 'Edit Contribution' : 'Add Contribution'}</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={cModal.data.sourceType||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, sourceType: e.target.value } }))}>
                <option>Trustee</option>
                <option>District</option>
                <option>NGO</option>
                <option>Other</option>
              </select>
              <input placeholder="Source Name" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={cModal.data.sourceName||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, sourceName: e.target.value } }))} />
              <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={cModal.data.type||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, type: e.target.value } }))}>
                <option>Financial</option>
                <option>Resource</option>
              </select>
              {cModal.data.type==='Financial' ? (
                <input placeholder="Amount" type="number" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={cModal.data.amount||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, amount: e.target.value } }))} />
              ) : (
                <input placeholder="Resource Description" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={cModal.data.resourceDescription||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, resourceDescription: e.target.value } }))} />
              )}
              <input placeholder="Date" type="date" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={cModal.data.date||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, date: e.target.value } }))} />
            </div>
            <textarea placeholder="Notes" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full" rows={3} value={cModal.data.notes||''} onChange={e=>setCModal(m=>({ ...m, data: { ...m.data, notes: e.target.value } }))}></textarea>
            <div className="flex items-center justify-end gap-2">
              <button onClick={()=>setCModal({ open:false, editId:null, data:{} })} className="px-3 py-1 rounded bg-white/10 text-sm">Cancel</button>
              <button onClick={saveContribution} className="px-3 py-1 rounded bg-indigo-600 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------- Attendance (School Admin) -------
function SchoolAdminAttendance({ token }) {
  const [tab, setTab] = useState('Students');
  // Students tab state
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [classes, setClasses] = useState([]);
  const [classCode, setClassCode] = useState('');
  const [records, setRecords] = useState([]);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth()+1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);

  // Build classes list from student management data
  async function loadClasses() {
    const res = await fetch(`${API}/school/students/manage?year=${new Date().getFullYear()}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) {
      const set = new Set();
      for (const r of (data.students||[])) {
        const cc = `${r.classLevel||'Unassigned'}-${r.section||'NA'}`;
        if (r.classLevel) set.add(cc);
      }
      const list = Array.from(set).sort();
      setClasses(list);
      if (!classCode && list.length) setClassCode(list[0]);
    }
  }

  async function loadClassAttendance() {
    if (!classCode) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/school/attendance/class/${encodeURIComponent(classCode)}?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setRecords(data.records||[]);
        setFinalized(!!data.finalized);
      }
    } finally { setLoading(false); }
  }

  async function mark(studentId, status) {
    const payload = { date, studentId, status };
    await fetch(`${API}/school/attendance/class/${encodeURIComponent(classCode)}/mark`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    loadClassAttendance();
  }

  async function finalizeDay() {
    const res = await fetch(`${API}/school/attendance/class/${encodeURIComponent(classCode)}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ date }) });
    if (res.ok) setFinalized(true);
  }

  async function loadMonthlySummary() {
    if (!classCode) return;
    const res = await fetch(`${API}/school/attendance/students/monthly-summary?classCode=${encodeURIComponent(classCode)}&year=${year}&month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setSummary(data.summary||null);
  }

  async function exportStudents(format) {
    const usp = new URLSearchParams();
    usp.set('classCode', classCode);
    usp.set('date', date);
    usp.set('format', format);
    const res = await fetch(`${API}/school/attendance/export/students?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${classCode}-${date}.${format==='pdf'?'pdf':'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  async function exportTeachers(format) {
    const usp = new URLSearchParams();
    usp.set('year', year);
    usp.set('month', month);
    usp.set('format', format);
    const res = await fetch(`${API}/school/attendance/export/teachers?${usp.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teacher-attendance-${month}-${year}.${format==='pdf'?'pdf':'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  useEffect(()=>{ loadClasses(); }, []);
  useEffect(()=>{ loadClassAttendance(); }, [classCode, date]);
  useEffect(()=>{ loadMonthlySummary(); }, [classCode, month, year]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={()=>setTab('Students')} className={`px-3 py-1 rounded ${tab==='Students'?'bg-white/20':'bg-white/10'} text-sm`}>Students</button>
        <button onClick={()=>setTab('Teachers')} className={`px-3 py-1 rounded ${tab==='Teachers'?'bg-white/20':'bg-white/10'} text-sm`}>Teachers</button>
        <div className="ml-auto flex items-center gap-2">
          {tab==='Students' ? (
            <>
              <button onClick={()=>exportStudents('csv')} className="px-3 py-1 rounded bg-white/20 text-sm">Export CSV</button>
              <button onClick={()=>exportStudents('pdf')} className="px-3 py-1 rounded bg-white/20 text-sm">Export PDF</button>
            </>
          ) : (
            <>
              <button onClick={()=>exportTeachers('csv')} className="px-3 py-1 rounded bg-white/20 text-sm">Export CSV</button>
              <button onClick={()=>exportTeachers('pdf')} className="px-3 py-1 rounded bg-white/20 text-sm">Export PDF</button>
            </>
          )}
        </div>
      </div>

      {tab==='Students' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-white/80">Date</div>
            <input type="date" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={date} onChange={e=>setDate(e.target.value)} />
            <div className="text-sm text-white/80">Class</div>
            <select className="bg-white text-black border border-white/20 rounded px-2 py-1 text-sm" value={classCode} onChange={e=>setClassCode(e.target.value)}>
              {classes.map(c=> <option className="text-black" key={c} value={c}>{c}</option>)}
            </select>
            {loading && <span className="text-xs text-white/80">Loading…</span>}
            <div className="ml-auto">
              <button disabled={finalized} onClick={finalizeDay} className={`px-3 py-1 rounded text-sm ${finalized? 'bg-white/10 text-white/60' : 'bg-indigo-600'}`}>{finalized? 'Finalized' : 'Finalize Day'}</button>
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-3 py-2 text-white/80">{r.rollNumber}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button disabled={finalized} onClick={()=>mark(r.id,'Present')} className="px-2 py-1 rounded bg-white/20">Present</button>
                      <button disabled={finalized} onClick={()=>mark(r.id,'Absent')} className="px-2 py-1 rounded bg-white/20">Absent</button>
                      <button disabled={finalized} onClick={()=>mark(r.id,'Late')} className="px-2 py-1 rounded bg-white/20">Late</button>
                      <button disabled={finalized} onClick={()=>mark(r.id,'Excused')} className="px-2 py-1 rounded bg-white/20">Excused</button>
                    </td>
                  </tr>
                ))}
                {records.length===0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-white/70">No students found for this class.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm text-white/80">Month</div>
              <input type="number" min={1} max={12} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={month} onChange={e=>setMonth(Number(e.target.value)||month)} />
              <div className="text-sm text-white/80">Year</div>
              <input type="number" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={year} onChange={e=>setYear(Number(e.target.value)||year)} />
              <button onClick={loadMonthlySummary} className="px-3 py-1 rounded bg-white/20 text-sm">Refresh</button>
            </div>
            {summary ? (
              <div className="grid grid-cols-4 gap-3">
                {['Present','Absent','Late','Excused'].map(k=> (
                  <div key={k} className="rounded-xl border border-white/15 bg-white/10 p-4 text-center">
                    <div className="text-2xl font-semibold">{summary.reduce((sum,s)=>sum+(s[k]||0),0)}</div>
                    <div className="text-xs text-white/80 mt-1">{k}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/80">No summary yet.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm text-white/80">Month</div>
            <input type="number" min={1} max={12} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={month} onChange={e=>setMonth(Number(e.target.value)||month)} />
            <div className="text-sm text-white/80">Year</div>
            <input type="number" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={year} onChange={e=>setYear(Number(e.target.value)||year)} />
            <button onClick={()=>exportTeachers('csv')} className="px-3 py-1 rounded bg-white/20 text-sm ml-auto">Export CSV</button>
          </div>
          <div className="text-sm text-white/80">Use the Teachers tab to mark attendance per teacher and view monthly summaries.</div>
        </div>
      )}
    </div>
  );
}

// ------- Reports & Insights (School Admin) -------
function SchoolAdminReports({ token }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/school/reports/insights?year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
      const js = await res.json();
      if (res.ok) setData(js);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, [year]);

  const best = data?.bestPerforming || [];
  const improve = data?.improvementNeeded || [];
  const corr = data?.attendanceVsPerformance || [];
  const monthly = data?.feeTrends?.monthly || [];
  const byClass = data?.feeTrends?.byClass || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-sm text-white/80">Academic Year</div>
        <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm" value={year} onChange={e=>setYear(Number(e.target.value)||year)}>
          {[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map(y=> <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span className="text-xs text-white/80">Loading…</span>}
      </div>

      {/* Top/Bottom classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Best Performing Classes</div>
          {best.length===0 ? (
            <div className="text-sm text-white/80">No report cards yet.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {best.map((r,i)=> (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded p-2">
                  <span>{r.classCode}</span>
                  <span className="font-semibold">{typeof r.avgScore==='number'? r.avgScore : '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Improvement Needed</div>
          {improve.length===0 ? (
            <div className="text-sm text-white/80">No report cards yet.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {improve.map((r,i)=> (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded p-2">
                  <span>{r.classCode}</span>
                  <span className="font-semibold">{typeof r.avgScore==='number'? r.avgScore : '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance vs Performance */}
      <div className="rounded-xl border border-white/15 bg-white/10 p-4">
        <div className="font-medium mb-2">Attendance vs Performance</div>
        {corr.length===0 ? (
          <div className="text-sm text-white/80">No data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left"><th className="px-3 py-2">Class</th><th className="px-3 py-2">Attendance %</th><th className="px-3 py-2">Avg Score</th></tr></thead>
              <tbody>
                {corr.map((r,i)=> (
                  <tr key={i} className="border-t border-white/10">
                    <td className="px-3 py-2">{r.classCode}</td>
                    <td className="px-3 py-2">{r.attendancePct!=null? `${r.attendancePct}%` : '-'}</td>
                    <td className="px-3 py-2">{r.performanceScore!=null? r.performanceScore : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fee trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Monthly Fee Collections</div>
          {monthly.length===0 ? (
            <div className="text-sm text-white/80">No payments recorded for {year}.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {monthly.map(m => (
                <div key={`${m.year}-${m.month}`} className="flex items-center justify-between bg-white/5 rounded p-2">
                  <span>{String(m.month).padStart(2,'0')}/{m.year}</span>
                  <span className="font-semibold">₹{Number(m.paidTotal||0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <div className="font-medium mb-2">Fee Aggregates by Class</div>
          {byClass.length===0 ? (
            <div className="text-sm text-white/80">No students with fee data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left"><th className="px-3 py-2">Class</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Paid</th><th className="px-3 py-2">Pending</th><th className="px-3 py-2">Students</th><th className="px-3 py-2">Fully Paid</th></tr></thead>
                <tbody>
                  {byClass.map(r => (
                    <tr key={r.classCode} className="border-t border-white/10">
                      <td className="px-3 py-2">{r.classCode}</td>
                      <td className="px-3 py-2">₹{Number(r.totalFee||0).toFixed(2)}</td>
                      <td className="px-3 py-2">₹{Number(r.paidAmount||0).toFixed(2)}</td>
                      <td className="px-3 py-2">₹{Number(r.pendingAmount||0).toFixed(2)}</td>
                      <td className="px-3 py-2">{r.students||0}</td>
                      <td className="px-3 py-2">{r.fullyPaid||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
