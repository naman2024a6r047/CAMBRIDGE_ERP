import { useState, useEffect, useMemo } from 'react';
import API from '../../utils/api';
import { CLASSES } from '../../constants/roles';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { key: 'all', label: 'All Datesheets' },
  { key: 'submitted', label: 'Pending Review' },
  { key: 'approved', label: 'Approved (Ready)' },
  { key: 'declared', label: 'Declared' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE = {
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

const SECTIONS = ['A', 'B', 'C', 'D'];

const EMPTY_ROW = () => ({
  subject: '',
  exam_date: '',
  start_time: '09:00',
  end_time: '12:00',
  room: '',
  syllabus_notes: '',
});

export default function AdminDatesheets() {
  const [loading, setLoading] = useState(true);
  const [datesheets, setDatesheets] = useState([]);
  const [summary, setSummary] = useState({});
  const [classMatrix, setClassMatrix] = useState([]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [examQuery, setExamQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Rejection remark modal state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  // Admin Create / Edit Datesheet Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState(null);
  const [editorClass, setEditorClass] = useState(CLASSES[0] || 'Nursery');
  const [editorSection, setEditorSection] = useState('All');
  const [editorExamName, setEditorExamName] = useState('');
  const [editorExamType, setEditorExamType] = useState('half_yearly');
  const [editorInstructions, setEditorInstructions] = useState('');
  const [editorRows, setEditorRows] = useState([EMPTY_ROW()]);
  const [editorSaving, setEditorSaving] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await API.get('/datesheets/admin');
      setDatesheets(Array.isArray(res.data?.datesheets) ? res.data.datesheets : []);
      setSummary(res.data?.summary || {});
      setClassMatrix(Array.isArray(res.data?.classMatrix) ? res.data.classMatrix : []);
    } catch {
      toast.error('Failed to load examination datesheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const distinctClasses = useMemo(() => {
    return ['all', ...CLASSES];
  }, []);

  const distinctSections = useMemo(() => {
    return ['all', ...SECTIONS];
  }, []);

  const filteredDatesheets = useMemo(() => {
    return datesheets.filter((ds) => {
      if (statusFilter !== 'all' && ds.status !== statusFilter) return false;
      if (classFilter !== 'all' && ds.class !== classFilter) return false;
      if (sectionFilter !== 'all') {
        const matchesSection =
          ds.section === sectionFilter ||
          (sectionFilter === 'All' && ['all', 'ALL', 'All'].includes(ds.section)) ||
          ['all', 'ALL', 'All'].includes(ds.section);
        if (!matchesSection) return false;
      }
      if (examQuery.trim() && !String(ds.exam_name || '').toLowerCase().includes(examQuery.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [datesheets, statusFilter, classFilter, sectionFilter, examQuery]);

  // Compute class readiness overview for all school classes before declaration
  const classCoverageRows = useMemo(() => {
    return classMatrix.filter(cm => CLASSES.includes(cm.class)).map((cm) => {
      const classSheets = datesheets.filter(
        (d) =>
          d.class === cm.class &&
          (d.section === cm.section || ['all', 'ALL', 'All'].includes(d.section)) &&
          (!examQuery.trim() || String(d.exam_name || '').toLowerCase().includes(examQuery.trim().toLowerCase()))
      );
      const latest = classSheets[0] || null;
      return {
        ...cm,
        status: latest ? latest.status : 'missing',
        exam_name: latest?.exam_name || null,
        entriesCount: latest?.entries?.length || 0,
      };
    });
  }, [classMatrix, datesheets, examQuery]);

  const openCreateModal = () => {
    setEditorId(null);
    setEditorClass(classFilter !== 'all' ? classFilter : (CLASSES[0] || 'Nursery'));
    setEditorSection(sectionFilter !== 'all' ? sectionFilter : 'All');
    setEditorExamName('');
    setEditorExamType('half_yearly');
    setEditorInstructions('');
    setEditorRows([EMPTY_ROW()]);
    setIsEditorOpen(true);
  };

  const openEditModal = (ds) => {
    setEditorId(ds.id);
    setEditorClass(ds.class || CLASSES[0]);
    setEditorSection(ds.section || 'All');
    setEditorExamName(ds.exam_name || '');
    setEditorExamType(ds.exam_type || 'half_yearly');
    setEditorInstructions(ds.instructions || '');
    setEditorRows(
      Array.isArray(ds.entries) && ds.entries.length > 0
        ? ds.entries.map((e) => ({
            subject: e.subject || '',
            exam_date: e.exam_date || '',
            start_time: e.start_time || '09:00',
            end_time: e.end_time || '12:00',
            room: e.room || '',
            syllabus_notes: e.syllabus_notes || '',
          }))
        : [EMPTY_ROW()]
    );
    setIsEditorOpen(true);
  };

  const closeEditorModal = () => {
    setIsEditorOpen(false);
    setEditorId(null);
    setEditorRows([EMPTY_ROW()]);
  };

  const updateEditorRow = (idx, field, val) => {
    setEditorRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  const addEditorRow = () => setEditorRows((prev) => [...prev, EMPTY_ROW()]);
  const removeEditorRow = (idx) => {
    if (editorRows.length <= 1) return;
    setEditorRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLoadClassSubjects = async () => {
    if (!editorClass) return;
    setLoadingSubjects(true);
    try {
      const params = { class: editorClass };
      if (editorSection && !['all', 'ALL', 'All'].includes(editorSection)) {
        params.section = editorSection;
      }
      const res = await API.get('/class-subjects', { params });
      const names = [...new Set((res.data || []).map((cs) => cs.subject).filter(Boolean))];
      if (names.length === 0) {
        toast('No pre-configured subjects found for this class. You can add subjects manually.', { icon: 'ℹ️' });
        return;
      }
      setEditorRows(
        names.map((subject) => ({
          subject,
          exam_date: '',
          start_time: '09:00',
          end_time: '12:00',
          room: '',
          syllabus_notes: '',
        }))
      );
      toast.success(
        `Loaded ${names.length} subject(s) for ${editorClass}${params.section ? ` - Section ${params.section}` : ' (All Sections)'}`
      );
    } catch {
      toast.error('Could not load subjects for this class.');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleSaveEditor = async (action) => {
    if (!editorClass?.trim() || !editorSection?.trim()) {
      return toast.error('Class and Section are required.');
    }
    if (!editorExamName.trim()) {
      return toast.error('Please enter an Exam Name (e.g. Half Yearly Examination 2026).');
    }
    if (!Array.isArray(editorRows) || editorRows.length === 0) {
      return toast.error('At least one exam entry is required.');
    }
    for (const [i, row] of editorRows.entries()) {
      if (!row.subject?.trim()) {
        return toast.error(`Subject is required for entry #${i + 1}.`);
      }
      if (!row.exam_date) {
        return toast.error(`Exam Date is required for "${row.subject}".`);
      }
      if (!row.start_time || !row.end_time) {
        return toast.error(`Timing is required for "${row.subject}".`);
      }
    }

    setEditorSaving(true);
    try {
      const payload = {
        class: editorClass.trim(),
        section: editorSection.trim(),
        exam_name: editorExamName.trim(),
        exam_type: editorExamType,
        instructions: editorInstructions.trim() || null,
        entries: editorRows.map((r) => ({
          subject: r.subject.trim(),
          exam_date: r.exam_date,
          start_time: r.start_time.trim(),
          end_time: r.end_time.trim(),
          room: r.room ? r.room.trim() : null,
          syllabus_notes: r.syllabus_notes ? r.syllabus_notes.trim() : null,
        })),
        action, // 'draft' | 'approve' | 'declare'
      };

      if (editorId) {
        await API.put(`/datesheets/${editorId}`, payload);
        toast.success(
          action === 'declare'
            ? 'Datesheet updated and officially declared! School-wide notification sent.'
            : action === 'approve'
            ? 'Datesheet updated and marked Approved (Ready).'
            : 'Datesheet updated successfully.'
        );
      } else {
        await API.post('/datesheets', payload);
        toast.success(
          action === 'declare'
            ? 'Datesheet created and officially declared! School-wide notification sent.'
            : action === 'approve'
            ? 'Datesheet created and marked Approved (Ready).'
            : 'Datesheet created as Draft.'
        );
      }

      closeEditorModal();
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save datesheet.');
    } finally {
      setEditorSaving(false);
    }
  };

  const handleReview = async (id, decision, notes = '') => {
    setBusyId(id);
    try {
      await API.put(`/datesheets/${id}/review`, { decision, review_notes: notes });
      toast.success(decision === 'approved' ? 'Datesheet approved!' : 'Datesheet sent back for revision.');
      setRejectTarget(null);
      setRejectNotes('');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Review action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclare = async (ds) => {
    const secDisplay = ['all', 'ALL', 'All'].includes(ds.section) ? 'All Sections' : `Section ${ds.section}`;
    if (
      !window.confirm(
        `Declare "${ds.exam_name}" datesheet for ${ds.class} - ${secDisplay}? This will immediately notify all students, parents, and teachers.`
      )
    ) {
      return;
    }
    setBusyId(ds.id);
    try {
      const res = await API.put(`/datesheets/${ds.id}/declare`);
      toast.success(res.data?.message || 'Datesheet declared!');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to declare datesheet.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (ds) => {
    const secDisplay = ['all', 'ALL', 'All'].includes(ds.section) ? 'All Sections' : `Section ${ds.section}`;
    if (
      !window.confirm(
        `Are you sure you want to delete "${ds.exam_name}" datesheet for ${ds.class} - ${secDisplay}? This action cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(ds.id);
    try {
      await API.delete(`/datesheets/${ds.id}`);
      toast.success('Datesheet deleted successfully.');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete datesheet.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkDeclare = async () => {
    const readyIds = filteredDatesheets
      .filter((d) => ['approved', 'submitted'].includes(d.status))
      .map((d) => d.id);
    if (readyIds.length === 0) {
      return toast.error('No approved or submitted datesheets match your current filter.');
    }
    if (
      !window.confirm(
        `Declare ${readyIds.length} class datesheet(s) together and send an official school-wide announcement notification to everyone?`
      )
    ) {
      return;
    }

    setBulkBusy(true);
    try {
      const res = await API.post('/datesheets/bulk-declare', {
        ids: readyIds,
        exam_name: examQuery.trim() || undefined,
      });
      toast.success(res.data?.message || 'Declared all selected datesheets!');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk declaration failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const readyCount = filteredDatesheets.filter((d) => ['approved', 'submitted'].includes(d.status)).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Examination Control
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-2">
            Class Exam Datesheet Management &amp; Declaration
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Create, approve, edit, and declare official examination datesheets for all classes with instant school-wide announcements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Create Datesheet Button */}
          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Datesheet</span>
          </button>

          {/* Bulk Declare Button */}
          <button
            type="button"
            disabled={bulkBusy || readyCount === 0}
            onClick={handleBulkDeclare}
            className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-lg shadow-purple-500/20 disabled:opacity-40 transition-all whitespace-nowrap"
          >
            {bulkBusy ? 'Declaring...' : `Declare All Ready (${readyCount})`}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summary.total || 0, cls: 'text-slate-800' },
          { label: 'Pending Review', value: summary.submitted || 0, cls: 'text-blue-700' },
          { label: 'Approved Ready', value: summary.approved || 0, cls: 'text-emerald-700' },
          { label: 'Declared', value: summary.declared || 0, cls: 'text-purple-700' },
          { label: 'Rejected', value: summary.rejected || 0, cls: 'text-rose-700' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* All-Class Status Coverage Overview Before Declaration */}
      {classCoverageRows.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">All-Class Submission Coverage</h2>
            <p className="text-xs text-slate-400">
              Verify every class &amp; section status prior to declaration.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {classCoverageRows.map((row) => (
              <div
                key={`${row.class}::${row.section}`}
                onClick={() => setClassFilter(row.class)}
                className="cursor-pointer p-3 rounded-2xl border border-slate-200/80 hover:border-indigo-300 bg-slate-50/70 transition-all"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-slate-800">
                    {row.class}-{row.section}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      row.status === 'declared'
                        ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : row.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : row.status === 'submitted'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : row.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                        : row.status === 'draft'
                        ? 'bg-slate-200 text-slate-600 border-slate-300'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-1">
                  {row.inchargeName ? `Incharge: ${row.inchargeName}` : 'Admin Created'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {row.entriesCount ? `${row.entriesCount} subject(s)` : 'No entries'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && summary[tab.key] !== undefined && (
                <span className="ml-1.5 opacity-80">({summary[tab.key]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search exam name (e.g. Half Yearly, Annual)..."
            value={examQuery}
            onChange={(e) => setExamQuery(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-600"
          />

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
          >
            {distinctClasses.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Classes' : c}
              </option>
            ))}
          </select>

          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
          >
            <option value="all">All Sections</option>
            {SECTIONS.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Datesheets List */}
      {filteredDatesheets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-12 text-center text-slate-400 text-xs font-medium space-y-3">
          <p>No datesheets matching your active filter criteria.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Datesheet</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDatesheets.map((ds) => {
            const isBusy = busyId === ds.id;
            const canApprove = ['submitted', 'rejected', 'draft'].includes(ds.status);
            const canReject = ['submitted'].includes(ds.status);
            const canDeclare = ds.status !== 'declared';

            return (
              <div
                key={ds.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-4 transition-all hover:border-slate-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-800">{ds.exam_name}</h3>
                      <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {ds.class} — {['all', 'ALL', 'All'].includes(ds.section) ? 'All Sections' : `Section ${ds.section}`}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${STATUS_BADGE[ds.status] || STATUS_BADGE.draft}`}>
                        {ds.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Prepared by: <span className="font-bold text-slate-700">{ds.createdByTeacher?.name || ds.createdByUser?.name || 'Admin'}</span>
                      {ds.entries?.length ? ` · ${ds.entries.length} subject paper(s)` : ''}
                      {ds.declared_at && ` · Declared on ${new Date(ds.declared_at).toLocaleDateString()}`}
                    </p>
                    {ds.review_notes && (
                      <p className="text-xs text-rose-600 font-semibold mt-1">Remarks: {ds.review_notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Edit Datesheet Button */}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openEditModal(ds)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>

                    {/* Approve Button */}
                    {canApprove && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReview(ds.id, 'approved')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}

                    {/* Reject Button */}
                    {canReject && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => { setRejectTarget(ds); setRejectNotes(''); }}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Reject / Return
                      </button>
                    )}

                    {/* Declare & Notify Button */}
                    {canDeclare && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeclare(ds)}
                        className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                        <span>{isBusy ? 'Declaring...' : 'Declare & Notify All'}</span>
                      </button>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDelete(ds)}
                      className="px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                      title="Delete Datesheet"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Timing</th>
                        <th className="py-2.5 px-3">Room / Hall</th>
                        <th className="py-2.5 px-3">Syllabus / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(ds.entries || []).map((en) => (
                        <tr key={en.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">{en.exam_date}</td>
                          <td className="py-2.5 px-3 font-extrabold text-indigo-700">{en.subject}</td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{en.start_time} – {en.end_time}</td>
                          <td className="py-2.5 px-3 text-slate-500">{en.room || 'TBA'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{en.syllabus_notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {ds.instructions && (
                  <p className="text-xs text-amber-800 bg-amber-50/70 border border-amber-100 px-3.5 py-2 rounded-xl">
                    <span className="font-bold">Instructions:</span> {ds.instructions}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Create / Edit Datesheet Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 w-full max-w-4xl shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">
                  {editorId ? 'Edit Examination Datesheet' : 'Create & Publish New Datesheet'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up the complete examination timetable for any class. You can save as Draft, Approve, or Declare immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditorModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* General Configuration Form */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Target Class *</label>
                <select
                  value={editorClass}
                  onChange={(e) => setEditorClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                >
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Section *</label>
                <select
                  value={editorSection}
                  onChange={(e) => setEditorSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                >
                  <option value="All">All Sections</option>
                  {SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Exam Type *</label>
                <select
                  value={editorExamType}
                  onChange={(e) => setEditorExamType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Exam Name / Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Half Yearly Examination 2026-27"
                  value={editorExamName}
                  onChange={(e) => setEditorExamName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                />
              </div>
            </div>

            {/* General Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">General Instructions (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Students must arrive 15 minutes before exam. Bring school ID and official writing instruments."
                value={editorInstructions}
                onChange={(e) => setEditorInstructions(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
              />
            </div>

            {/* Subject Entries Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Exam Papers &amp; Schedule</h3>
                  <p className="text-[11px] text-slate-400">Add dates, timings, rooms, and syllabus for each subject.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingSubjects}
                    onClick={handleLoadClassSubjects}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {loadingSubjects ? 'Loading...' : 'Auto-Load Subjects'}
                  </button>
                  <button
                    type="button"
                    onClick={addEditorRow}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>+ Add Subject</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3">Subject *</th>
                      <th className="py-2.5 px-3">Exam Date *</th>
                      <th className="py-2.5 px-3">Start Time *</th>
                      <th className="py-2.5 px-3">End Time *</th>
                      <th className="py-2.5 px-3">Room / Hall</th>
                      <th className="py-2.5 px-3">Syllabus / Notes</th>
                      <th className="py-2.5 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editorRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="e.g. Mathematics"
                            value={row.subject}
                            onChange={(e) => updateEditorRow(idx, 'subject', e.target.value)}
                            className="w-full min-w-[120px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="date"
                            value={row.exam_date}
                            onChange={(e) => updateEditorRow(idx, 'exam_date', e.target.value)}
                            className="w-full min-w-[130px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="time"
                            value={row.start_time}
                            onChange={(e) => updateEditorRow(idx, 'start_time', e.target.value)}
                            className="w-full min-w-[90px] px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="time"
                            value={row.end_time}
                            onChange={(e) => updateEditorRow(idx, 'end_time', e.target.value)}
                            className="w-full min-w-[90px] px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Hall 1 / Room 102"
                            value={row.room}
                            onChange={(e) => updateEditorRow(idx, 'room', e.target.value)}
                            className="w-full min-w-[100px] px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Chapters 1-5"
                            value={row.syllabus_notes}
                            onChange={(e) => updateEditorRow(idx, 'syllabus_notes', e.target.value)}
                            className="w-full min-w-[120px] px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            disabled={editorRows.length <= 1}
                            onClick={() => removeEditorRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors"
                            title="Remove Subject"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeEditorModal}
                disabled={editorSaving}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {/* Save Draft */}
                <button
                  type="button"
                  disabled={editorSaving}
                  onClick={() => handleSaveEditor('draft')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50"
                >
                  Save as Draft
                </button>

                {/* Approve Ready */}
                <button
                  type="button"
                  disabled={editorSaving}
                  onClick={() => handleSaveEditor('approve')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                >
                  Save &amp; Approve Ready
                </button>

                {/* Create & Declare / Publish Immediately */}
                <button
                  type="button"
                  disabled={editorSaving}
                  onClick={() => handleSaveEditor('declare')}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {editorSaving ? (
                    <span>Publishing...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                      <span>Declare &amp; Publish Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-800">
              Return Datesheet for Revision
            </h3>
            <p className="text-xs text-slate-500">
              Provide feedback for {rejectTarget.class} - {['all', 'ALL', 'All'].includes(rejectTarget.section) ? 'All Sections' : `Section ${rejectTarget.section}`} ({rejectTarget.exam_name}).
            </p>
            <textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. Science and Maths exam dates clash with holiday..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectNotes.trim() || busyId === rejectTarget.id}
                onClick={() => handleReview(rejectTarget.id, 'rejected', rejectNotes)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                Return to Incharge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
