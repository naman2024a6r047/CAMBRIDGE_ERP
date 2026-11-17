import { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { CLASSES } from '../../constants/roles';
import toast from 'react-hot-toast';

const EMPTY_ROW = () => ({
  subject: '',
  exam_date: '',
  start_time: '09:00',
  end_time: '12:00',
  room: '',
  syllabus_notes: '',
});

const STATUS_BADGES = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  declared: 'bg-purple-50 text-purple-700 border-purple-200',
};

const EXAM_TYPES = [
  { value: 'unit_test', label: 'Unit Test' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual Examination' },
  { value: 'assessment', label: 'Periodic Assessment' },
  { value: 'pre_board', label: 'Pre-Board' },
  { value: 'other', label: 'Other' },
];

const formatTime12 = (time24) => {
  if (!time24) return '';
  const [hStr, mStr] = String(time24).split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr || '00'} ${period}`;
};

const formatDateLong = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function InchargeDatesheet() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [datesheets, setDatesheets] = useState([]);
  const [declaredDatesheets, setDeclaredDatesheets] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);

  // Active view tab: 'published' | 'builder'
  const [activeTab, setActiveTab] = useState('published');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor State
  const [editingId, setEditingId] = useState(null);
  const [selectedPairKey, setSelectedPairKey] = useState('');
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState('half_yearly');
  const [instructions, setInstructions] = useState('');
  const [rows, setRows] = useState([EMPTY_ROW()]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inchargeRes, declaredRes] = await Promise.all([
        API.get('/datesheets/incharge').catch(() => ({ data: { assignedClasses: [], datesheets: [] } })),
        API.get('/datesheets/student', { params: { class: 'all' } }).catch(() => ({ data: { datesheets: [] } })),
      ]);

      const ac = Array.isArray(inchargeRes.data?.assignedClasses) ? inchargeRes.data.assignedClasses : [];
      const ds = Array.isArray(inchargeRes.data?.datesheets) ? inchargeRes.data.datesheets : [];
      const declared = Array.isArray(declaredRes.data?.datesheets) ? declaredRes.data.datesheets : [];

      setAssignedClasses(ac);
      setDatesheets(ds);
      setDeclaredDatesheets(declared);

      // If teacher is class incharge, default to builder if they have drafts or haven't chosen yet
      if (ac.length > 0) {
        setSelectedPairKey((prev) => prev || `${ac[0].class}::${ac[0].section}`);
        setActiveTab((prev) => prev || 'builder');
      } else {
        setActiveTab('published');
      }
    } catch {
      toast.error('Failed to load datesheet workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedClassInfo = useMemo(() => {
    if (!selectedPairKey) return null;
    const [cls, section] = selectedPairKey.split('::');
    return assignedClasses.find((a) => a.class === cls && a.section === section) || { class: cls, section };
  }, [selectedPairKey, assignedClasses]);

  useEffect(() => {
    if (!selectedClassInfo?.class) return;
    API.get('/class-subjects', {
      params: { class: selectedClassInfo.class, section: selectedClassInfo.section },
    })
      .then((res) => setClassSubjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClassSubjects([]));
  }, [selectedClassInfo?.class, selectedClassInfo?.section]);

  const resetForm = () => {
    setEditingId(null);
    setExamName('');
    setExamType('half_yearly');
    setInstructions('');
    setRows([EMPTY_ROW()]);
  };

  const handleLoadSubjects = () => {
    const names = [...new Set(classSubjects.map((cs) => cs.subject).filter(Boolean))];
    if (names.length === 0) {
      toast('No pre-configured subjects found for this class. Add subjects manually below.', { icon: 'ℹ️' });
      return;
    }
    setRows(
      names.map((subject) => ({
        subject,
        exam_date: '',
        start_time: '09:00',
        end_time: '12:00',
        room: '',
        syllabus_notes: '',
      }))
    );
    toast.success(`Loaded ${names.length} subject(s) for ${selectedClassInfo.class} - ${selectedClassInfo.section}`);
  };

  const updateRow = (idx, field, val) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);
  const removeRow = (idx) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const startEdit = (ds) => {
    setEditingId(ds.id);
    setSelectedPairKey(`${ds.class}::${ds.section}`);
    setExamName(ds.exam_name || '');
    setExamType(ds.exam_type || 'half_yearly');
    setInstructions(ds.instructions || '');
    if (Array.isArray(ds.entries) && ds.entries.length > 0) {
      setRows(
        ds.entries.map((e) => ({
          subject: e.subject || '',
          exam_date: e.exam_date || '',
          start_time: e.start_time ? String(e.start_time).slice(0, 5) : '09:00',
          end_time: e.end_time ? String(e.end_time).slice(0, 5) : '12:00',
          room: e.room || '',
          syllabus_notes: e.syllabus_notes || '',
        }))
      );
    } else {
      setRows([EMPTY_ROW()]);
    }
    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (action = 'draft') => {
    if (!examName.trim()) {
      toast.error('Please enter the exam name.');
      return;
    }
    if (!selectedClassInfo?.class) {
      toast.error('Please select a valid class and section.');
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.subject?.trim() || !r.exam_date || !r.start_time || !r.end_time) {
        toast.error(`Please fill in subject, date, and timing for exam row #${i + 1}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        exam_name: examName.trim(),
        exam_type: examType,
        class: selectedClassInfo.class,
        section: selectedClassInfo.section,
        session_id: selectedClassInfo.session_id || null,
        instructions: instructions.trim() || null,
        entries: rows.map((r) => ({
          subject: r.subject.trim(),
          exam_date: r.exam_date,
          start_time: r.start_time,
          end_time: r.end_time,
          room: r.room?.trim() || null,
          syllabus_notes: r.syllabus_notes?.trim() || null,
        })),
        action,
      };

      if (editingId) {
        await API.put(`/datesheets/${editingId}`, payload);
      } else {
        await API.post('/datesheets', payload);
      }

      toast.success(
        action === 'submit'
          ? 'Datesheet submitted to Admin for approval and declaration!'
          : 'Datesheet saved as draft.'
      );
      resetForm();
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save datesheet.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ds) => {
    if (!window.confirm(`Delete "${ds.exam_name}" (${ds.class} - ${ds.section})?`)) return;
    try {
      await API.delete(`/datesheets/${ds.id}`);
      toast.success('Datesheet deleted.');
      if (editingId === ds.id) resetForm();
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete datesheet.');
    }
  };

  // Filter declared datesheets
  const filteredDeclared = useMemo(() => {
    return declaredDatesheets.filter((ds) => {
      if (selectedClassFilter !== 'all') {
        const normFilter = selectedClassFilter.toLowerCase().replace(/class\s+/i, '').replace(/th|st|nd|rd/i, '').trim();
        const normClass = String(ds.class || '').toLowerCase().replace(/class\s+/i, '').replace(/th|st|nd|rd/i, '').trim();
        if (normFilter !== normClass) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = ds.exam_name?.toLowerCase().includes(q);
        const matchesSubject = (ds.entries || []).some((e) => e.subject?.toLowerCase().includes(q));
        const matchesClass = ds.class?.toLowerCase().includes(q);
        if (!matchesName && !matchesSubject && !matchesClass) return false;
      }
      return true;
    });
  }, [declaredDatesheets, selectedClassFilter, searchQuery]);

  if (loading) return <LoadingSpinner />;

  const isClassIncharge = assignedClasses.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              {isClassIncharge ? 'Class Incharge & Teaching Staff' : 'Teacher Examination Portal'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ Open to All Teachers
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            School Exam Datesheets &amp; Schedules
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Access declared datesheets across all classes, view exam timings, rooms, and paper syllabi.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('published')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'published'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📋 Declared Datesheets ({declaredDatesheets.length})</span>
          </button>

          {isClassIncharge && (
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>✍️ Incharge Builder ({assignedClasses.length} assigned)</span>
            </button>
          )}
        </div>
      </div>

      {/* Non-Incharge Informative Banner */}
      {!isClassIncharge && (
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-center justify-between text-xs text-blue-800 font-medium">
          <div className="flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            <span>
              You are viewing official school examination schedules. If you are designated to prepare datesheets for a class, please ask Admin to link your Class Incharge assignment.
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DECLARED & PUBLISHED DATESHEETS (VISIBLE TO ALL TEACHERS)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'published' && (
        <div className="space-y-5">
          {/* Controls: Class Pills & Search */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Filter by Academic Class</h3>
                <p className="text-[11px] text-slate-400">View schedules across all classes in the school</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subject, exam, room..."
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 w-56"
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Print Datesheet
                </button>
              </div>
            </div>

            {/* Class Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedClassFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  selectedClassFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Classes ({declaredDatesheets.length})
              </button>
              {CLASSES.map((cls) => {
                const count = declaredDatesheets.filter((d) => {
                  const normA = cls.toLowerCase().replace(/class\s+/i, '').replace(/th|st|nd|rd/i, '').trim();
                  const normB = String(d.class || '').toLowerCase().replace(/class\s+/i, '').replace(/th|st|nd|rd/i, '').trim();
                  return normA === normB;
                }).length;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedClassFilter(cls)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                      selectedClassFilter === cls
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cls} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Declared Datesheet Cards */}
          {filteredDeclared.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-12 text-center space-y-2">
              <span className="text-3xl block">📅</span>
              <h3 className="text-base font-bold text-slate-800">No Declared Datesheets Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No official exam datesheets match the selected class or search query. Declared schedules will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredDeclared.map((ds) => (
                <div key={ds.id} className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/70 to-white">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {ds.exam_type?.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Declared Official
                        </span>
                        <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {ds.class} — {['all', 'ALL', 'All', 'All Sections'].includes(ds.section) ? 'All Sections' : `Section ${ds.section}`}
                        </span>
                      </div>
                      <h2 className="text-xl font-extrabold text-slate-800 mt-2">{ds.exam_name}</h2>
                      {ds.instructions && (
                        <p className="text-xs text-slate-500 mt-1 font-medium italic">
                          Instructions: {ds.instructions}
                        </p>
                      )}
                    </div>

                    <div className="text-right text-xs text-slate-500 space-y-1">
                      {ds.createdByTeacher?.name && (
                        <div>Prepared by: <strong className="text-slate-700">{ds.createdByTeacher.name}</strong></div>
                      )}
                      {ds.declaredByUser?.name && (
                        <div>Declared by: <strong className="text-slate-700">{ds.declaredByUser.name}</strong></div>
                      )}
                      {ds.declared_at && (
                        <div className="text-[11px] text-slate-400">
                          Declared: {new Date(ds.declared_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timetable Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3.5 px-5">Date &amp; Day</th>
                          <th className="py-3.5 px-5">Subject</th>
                          <th className="py-3.5 px-5">Timing</th>
                          <th className="py-3.5 px-5">Room / Hall</th>
                          <th className="py-3.5 px-5">Syllabus / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {(ds.entries || []).map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-slate-800 whitespace-nowrap">
                              {formatDateLong(entry.exam_date)}
                            </td>
                            <td className="py-3.5 px-5 font-extrabold text-indigo-700">{entry.subject}</td>
                            <td className="py-3.5 px-5 text-xs font-semibold text-slate-600 whitespace-nowrap">
                              {formatTime12(entry.start_time)} – {formatTime12(entry.end_time)}
                            </td>
                            <td className="py-3.5 px-5 text-xs font-medium text-slate-600">{entry.room || '—'}</td>
                            <td className="py-3.5 px-5 text-xs text-slate-500">{entry.syllabus_notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: INCHARGE BUILDER (FOR CLASS INCHARGES)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'builder' && isClassIncharge && (
        <div className="space-y-6">
          {/* Builder Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-800">
                {editingId ? 'Edit Exam Datesheet' : 'Create New Exam Datesheet'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSubjects}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all whitespace-nowrap"
                >
                  Auto-Fill Class Subjects
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Class &amp; Section
                </label>
                <select
                  value={selectedPairKey}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setSelectedPairKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                >
                  {assignedClasses.map((ac) => (
                    <option key={`${ac.class}::${ac.section}`} value={`${ac.class}::${ac.section}`}>
                      {ac.class} — Section {ac.section}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Exam Name *
                </label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. Half Yearly Examination 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Exam Type
                </label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {EXAM_TYPES.map((et) => (
                    <option key={et.value} value={et.value}>{et.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Exam Rows Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="p-3">#</th>
                    <th className="p-3 min-w-[160px]">Subject *</th>
                    <th className="p-3 min-w-[130px]">Exam Date *</th>
                    <th className="p-3 min-w-[100px]">Start Time *</th>
                    <th className="p-3 min-w-[100px]">End Time *</th>
                    <th className="p-3 min-w-[110px]">Room / Hall</th>
                    <th className="p-3 min-w-[160px]">Syllabus Notes</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.subject}
                          onChange={(e) => updateRow(idx, 'subject', e.target.value)}
                          placeholder="e.g. Mathematics"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="date"
                          value={row.exam_date}
                          onChange={(e) => updateRow(idx, 'exam_date', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="time"
                          value={row.start_time}
                          onChange={(e) => updateRow(idx, 'start_time', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="time"
                          value={row.end_time}
                          onChange={(e) => updateRow(idx, 'end_time', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.room}
                          onChange={(e) => updateRow(idx, 'room', e.target.value)}
                          placeholder="Hall A"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.syllabus_notes}
                          onChange={(e) => updateRow(idx, 'syllabus_notes', e.target.value)}
                          placeholder="Ch. 1 to 6"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          disabled={rows.length <= 1}
                          onClick={() => removeRow(idx)}
                          className="text-rose-500 hover:text-rose-700 disabled:opacity-30 text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-50"
                          title="Remove Row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 w-fit transition-all"
              >
                + Add Subject Exam Row
              </button>

              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Optional exam instructions (e.g. Reporting time 8:30 AM, bring admit card)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('submit')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit to Admin'}
                </button>
              </div>
            </div>
          </div>

          {/* Incharge's Submitted & Draft Datesheets */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-800">My Prepared Datesheets ({datesheets.length})</h2>

            {datesheets.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                No datesheets created for your assigned class(es) yet.
              </p>
            ) : (
              <div className="space-y-4">
                {datesheets.map((ds) => {
                  const canEdit = !['approved', 'declared'].includes(ds.status);
                  const canDelete = ['draft', 'rejected'].includes(ds.status);
                  return (
                    <div key={ds.id} className="border border-slate-200 rounded-2xl p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-800">{ds.exam_name}</span>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {ds.class} — Sec {ds.section}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${STATUS_BADGES[ds.status] || STATUS_BADGES.draft}`}>
                              {ds.status}
                            </span>
                          </div>
                          {ds.review_notes && (
                            <p className="text-xs text-rose-600 font-semibold mt-1">
                              Admin Remarks: {ds.review_notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => startEdit(ds)}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all"
                            >
                              Edit / Resubmit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(ds)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-all"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                              <th className="py-2 pr-4">Date</th>
                              <th className="py-2 pr-4">Subject</th>
                              <th className="py-2 pr-4">Time</th>
                              <th className="py-2 pr-4">Room</th>
                              <th className="py-2">Syllabus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(ds.entries || []).map((en) => (
                              <tr key={en.id}>
                                <td className="py-2 pr-4 font-bold text-slate-700">{en.exam_date}</td>
                                <td className="py-2 pr-4 font-bold text-indigo-700">{en.subject}</td>
                                <td className="py-2 pr-4 text-slate-500">{en.start_time} – {en.end_time}</td>
                                <td className="py-2 pr-4 text-slate-500">{en.room || '—'}</td>
                                <td className="py-2 text-slate-500">{en.syllabus_notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
