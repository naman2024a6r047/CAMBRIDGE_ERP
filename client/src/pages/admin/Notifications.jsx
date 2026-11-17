import { useState, useEffect, useRef, useMemo } from 'react';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../utils/roleUtils';
import { formatDate } from '../../utils/helpers';
import { CLASSES, SECTIONS, SUBJECTS } from '../../constants/roles';
import toast from 'react-hot-toast';

const NOTIF_TYPES = [
  { value: 'general',          label: 'General Notice',         icon: 'ℹ️', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'academic',         label: 'Academic & Homework',     icon: '📚', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'fee_reminder',     label: 'Fee Reminder',           icon: '💳', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'exam_datesheet',   label: 'Exam & Datesheet',       icon: '📝', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'result',           label: 'Result & Marksheets',     icon: '📊', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'attendance_alert', label: 'Attendance Alert',       icon: '⏰', badge: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'holiday',          label: 'Holiday & Vacation',      icon: '🌴', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'achievement',      label: 'Event & Sports',          icon: '🏆', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'emergency',        label: 'Urgent Alert',           icon: '🚨', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
];

const PRESET_SUBCATEGORIES = [
  'Circular',
  'Parent-Teacher Meeting (PTM)',
  'Homework & Syllabus',
  'Fee Notice',
  'Exam Datesheet',
  'Report Card',
  'Holiday Notice',
  'Sports Day',
  'Annual Function',
  'Dress Code / Uniform',
  'Discipline & Safety',
  'Urgent Alert',
];

const EXTENDED_SUBJECTS = [
  'All Subjects / Departments',
  ...SUBJECTS,
  'Urdu',
  'Kashmiri',
  'Arabic',
  'Class Incharges Only',
];

export default function Notifications() {
  const { user }  = useAuth();
  const canSend   = can(user, 'SEND_NOTIFICATIONS');

  const [notifs, setNotifs]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);

  // Audience State: 'all' | 'teachers' | 'students' | 'individual'
  const [audience, setAudience]       = useState('all');

  // Subcategory & targeting options
  const [targetClass, setTargetClass]     = useState('all');
  const [targetSection, setTargetSection] = useState('all');
  const [targetSubject, setTargetSubject] = useState('all');
  const [subCategory, setSubCategory]     = useState('Circular');
  const [customSubCat, setCustomSubCat]   = useState('');
  const [priority, setPriority]           = useState('normal');

  // Notice content
  const [title, setTitle]                 = useState('');
  const [message, setMessage]             = useState('');
  const [type, setType]                   = useState('general');

  // Individual user search
  const [userQuery, setUserQuery]         = useState('');
  const [userResults, setUserResults]     = useState([]);
  const [selectedUser, setSelectedUser]   = useState(null);
  const searchTimer = useRef(null);

  // Filter in list
  const [filterAudience, setFilterAudience] = useState('all');
  const [searchFilter, setSearchFilter]     = useState('');

  const load = () => {
    setLoading(true);
    API.get('/notifications')
      .then(r => setNotifs(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Failed to load notifications.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const searchUsers = (q) => {
    clearTimeout(searchTimer.current);
    if (!q || q.length < 2) { setUserResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await API.get(`/notifications/users/search?search=${encodeURIComponent(q)}`);
        setUserResults(r.data?.users || []);
      } catch {}
    }, 350);
  };

  const effectiveSubCategory = useMemo(() => {
    if (customSubCat.trim()) return customSubCat.trim();
    return subCategory || 'General';
  }, [subCategory, customSubCat]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      return toast.error('Please enter both title and message.');
    }

    if (audience === 'individual' && !selectedUser) {
      return toast.error('Please search and select a recipient user.');
    }

    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        recipient_type: audience === 'individual' ? 'individual' : audience === 'all' ? 'all' : 'role',
        recipient_role: audience === 'teachers' ? 'teachers' : audience === 'students' ? 'students' : (audience === 'all' ? 'all' : undefined),
        recipient_user_id: audience === 'individual' ? selectedUser.id : undefined,
        target_class: audience === 'students' && targetClass !== 'all' ? targetClass : undefined,
        target_section: audience === 'students' && targetSection !== 'all' ? targetSection : undefined,
        target_subject: audience === 'teachers' && targetSubject !== 'all' ? targetSubject : undefined,
        sub_category: effectiveSubCategory,
        priority,
      };

      await API.post('/notifications', payload);
      toast.success('Notification sent successfully!');

      // Reset form
      setTitle('');
      setMessage('');
      setSelectedUser(null);
      setUserQuery('');
      setUserResults([]);
      setCustomSubCat('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) return;
    try {
      await API.delete(`/notifications/${id}`);
      toast.success('Notification deleted.');
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch {
      toast.error('Failed to delete notification.');
    }
  };

  // Filter list
  const filteredNotifs = useMemo(() => {
    return notifs.filter(n => {
      // Filter by audience
      if (filterAudience === 'teachers') {
        const isTeacher = n.recipient_role === 'teachers' || n.recipient_role === 'teacher';
        if (!isTeacher) return false;
      } else if (filterAudience === 'students') {
        const isStudent = n.recipient_role === 'students' || n.recipient_role === 'student' || n.recipient_role === 'parents' || n.recipient_role === 'parent';
        if (!isStudent) return false;
      } else if (filterAudience === 'all') {
        // show all
      } else if (filterAudience === 'everyone') {
        if (n.recipient_type !== 'all' && n.recipient_role !== 'all') return false;
      } else if (filterAudience === 'urgent') {
        if (n.priority !== 'urgent') return false;
      }

      // Filter by search text
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesMsg   = n.message?.toLowerCase().includes(q);
        const matchesSub   = n.sub_category?.toLowerCase().includes(q);
        const matchesClass = n.target_class?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg && !matchesSub && !matchesClass) return false;
      }

      return true;
    });
  }, [notifs, filterAudience, searchFilter]);

  const f = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white transition-all';
  const l = 'block text-xs font-semibold text-gray-600 mb-1.5';

  const selectedTypeObj = NOTIF_TYPES.find(t => t.value === type) || NOTIF_TYPES[0];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📢</span>
            <h2 className="text-lg font-bold">Custom Notifications & Announcements</h2>
          </div>
          <p className="text-blue-200 text-xs mt-1">
            Broadcast to teachers only, students only, entire school, or target by specific class & subject subcategories
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-white/10 px-3 py-1.5 rounded-lg font-medium border border-white/10">
            Total Notices: {notifs.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Send form */}
        {canSend && (
          <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span>✍️</span> Compose Custom Notification
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Admin Dispatch
              </span>
            </div>

            {/* 1. AUDIENCE SELECTOR: All vs Teachers Only vs Students Only vs Individual */}
            <div>
              <label className={l}>Target Audience *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAudience('all')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    audience === 'all'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>🌐</span> Everyone (All)
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('teachers')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    audience === 'teachers'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>👨‍🏫</span> Teachers Only
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('students')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    audience === 'students'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>🎓</span> Students Only
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('individual')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    audience === 'individual'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>👤</span> Individual
                </button>
              </div>
            </div>

            {/* 2. SUB-CATEGORIES FOR TARGET AUDIENCE */}

            {/* TEACHER SUBCATEGORIES */}
            {audience === 'teachers' && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">👨‍🏫 Teacher Subcategory</span>
                  <span className="text-[10px] text-indigo-600">Select department or group</span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-indigo-800 mb-1">Target Department / Subject</label>
                  <select
                    value={targetSubject}
                    onChange={e => setTargetSubject(e.target.value)}
                    className={f}
                  >
                    <option value="all">All Teachers (Entire Teaching Staff)</option>
                    {EXTENDED_SUBJECTS.filter(s => s !== 'All Subjects / Departments').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STUDENT SUBCATEGORIES (Class & Section) */}
            {audience === 'students' && (
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">🎓 Student Class Subcategory</span>
                  <span className="text-[10px] text-emerald-600">Nursery to Class 8th</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-800 mb-1">Target Class</label>
                    <select
                      value={targetClass}
                      onChange={e => setTargetClass(e.target.value)}
                      className={f}
                    >
                      <option value="all">All Classes (Nursery - 8th)</option>
                      {CLASSES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-800 mb-1">Target Section</label>
                    <select
                      value={targetSection}
                      onChange={e => setTargetSection(e.target.value)}
                      className={f}
                    >
                      <option value="all">All Sections</option>
                      {SECTIONS.map(s => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* INDIVIDUAL USER SEARCH */}
            {audience === 'individual' && (
              <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-bold text-purple-900">👤 Search & Select User</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-purple-200 rounded-xl shadow-xs">
                    <div>
                      <p className="font-semibold text-xs text-gray-800">{selectedUser.name}</p>
                      <p className="text-[11px] text-gray-500">{selectedUser.email} · <span className="uppercase text-purple-700 font-bold">{selectedUser.role}</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setUserQuery(''); }}
                      className="text-gray-400 hover:text-red-500 px-2 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={userQuery}
                      onChange={e => { setUserQuery(e.target.value); searchUsers(e.target.value); }}
                      className={f}
                      placeholder="Type teacher or student name / email..."
                    />
                    {userResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 z-20 max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {userResults.map(u => (
                          <div
                            key={u.id}
                            onClick={() => { setSelectedUser(u); setUserResults([]); setUserQuery(''); }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-purple-50 cursor-pointer"
                          >
                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {u.name?.[0] || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{u.email} · {u.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. NOTICE TYPE & PRIORITY */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={l}>Notice Category</label>
                <select value={type} onChange={e => setType(e.target.value)} className={f}>
                  {NOTIF_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={l}>Priority Level</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className={`${f} ${
                    priority === 'urgent'
                      ? 'border-red-400 bg-red-50/50 text-red-700 font-bold'
                      : priority === 'high'
                      ? 'border-amber-400 bg-amber-50/50 text-amber-800 font-semibold'
                      : ''
                  }`}
                >
                  <option value="normal">⚪ Normal</option>
                  <option value="high">🟡 High Priority</option>
                  <option value="urgent">🔴 Urgent / Critical</option>
                </select>
              </div>
            </div>

            {/* 4. SUB-CATEGORY TAG (Chips + Custom Input) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={l}>Subcategory / Tag</label>
                <span className="text-[10px] text-gray-400">Click a preset or enter custom</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_SUBCATEGORIES.slice(0, 8).map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => { setSubCategory(chip); setCustomSubCat(''); }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-all ${
                      subCategory === chip && !customSubCat
                        ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <input
                value={customSubCat}
                onChange={e => setCustomSubCat(e.target.value)}
                className={f}
                placeholder={`Custom subcategory (e.g. "${subCategory}")`}
              />
            </div>

            {/* 5. TITLE & MESSAGE */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={l}>Notice Title *</label>
                <span className="text-[10px] text-gray-400">{title.length} / 150</span>
              </div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={150}
                className={f}
                placeholder="e.g. Schedule for 1st Term Date Sheet"
              />
            </div>

            <div>
              <label className={l}>Message Content *</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className={f}
                placeholder="Type your notice announcement details here..."
              />
            </div>

            {/* LIVE PREVIEW CARD */}
            {(title.trim() || message.trim()) && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Live Preview</span>
                <div className={`p-3 rounded-lg bg-white border ${priority === 'urgent' ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-base">{selectedTypeObj.icon}</span>
                    <span className="font-bold text-xs text-gray-900">{title || 'Untitled Notice'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                      🏷️ {effectiveSubCategory}
                    </span>
                    {priority === 'urgent' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold animate-pulse">
                        🚨 Urgent
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                      To: {audience === 'all' ? 'Everyone' : audience === 'teachers' ? `Teachers (${targetSubject})` : audience === 'students' ? `Students (${targetClass})` : 'Individual'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{message || 'Message preview...'}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>{sending ? 'Sending Notice...' : '🚀 Dispatch Custom Notification'}</span>
            </button>
          </div>
        )}

        {/* Notification History List */}
        <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col ${!canSend ? 'lg:col-span-12' : 'lg:col-span-7'}`}>
          {/* Header & Filter Controls */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span>📋</span> Notifications Archive ({filteredNotifs.length})
              </h3>
              <input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search notices, class, tag..."
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 w-full sm:w-56"
              />
            </div>

            {/* Audience Filter Pills */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: 'all',      label: 'All Notices' },
                { id: 'teachers', label: '👨‍🏫 Teachers Only' },
                { id: 'students', label: '🎓 Students Only' },
                { id: 'everyone', label: '🌐 Everyone' },
                { id: 'urgent',   label: '🚨 Urgent' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterAudience(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    filterAudience === tab.id
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto max-h-[680px] divide-y divide-gray-100">
            {loading ? (
              <p className="text-center py-16 text-gray-400 text-xs">Loading notifications...</p>
            ) : filteredNotifs.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <span className="text-3xl text-gray-300">📭</span>
                <p className="text-gray-400 text-xs">No notifications found in this category.</p>
              </div>
            ) : (
              filteredNotifs.map(n => {
                const typeObj = NOTIF_TYPES.find(t => t.value === n.type) || NOTIF_TYPES[0];
                const isUrgent = n.priority === 'urgent';
                const isHigh   = n.priority === 'high';

                // Format Audience Label
                let audienceLabel = '🌐 Everyone';
                let audienceBg = 'bg-gray-100 text-gray-700';

                if (n.recipient_type === 'individual') {
                  audienceLabel = '👤 Individual';
                  audienceBg = 'bg-purple-100 text-purple-700';
                } else if (n.recipient_role === 'teachers' || n.recipient_role === 'teacher') {
                  audienceLabel = n.target_subject ? `👨‍🏫 Teachers (${n.target_subject})` : '👨‍🏫 Teachers Only';
                  audienceBg = 'bg-indigo-100 text-indigo-700 font-semibold';
                } else if (['students', 'student', 'parents', 'parent'].includes(n.recipient_role)) {
                  const classPart = n.target_class ? n.target_class : 'All Classes';
                  const secPart   = n.target_section ? `-${n.target_section}` : '';
                  audienceLabel = `🎓 Students (${classPart}${secPart})`;
                  audienceBg = 'bg-emerald-100 text-emerald-800 font-semibold';
                }

                return (
                  <div
                    key={n.id}
                    className={`p-4 transition-colors hover:bg-gray-50 flex gap-3 ${
                      isUrgent ? 'bg-red-50/40 border-l-4 border-red-500' : isHigh ? 'border-l-4 border-amber-400' : ''
                    }`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{typeObj.icon}</span>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900">{n.title}</span>

                        {/* Audience badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${audienceBg}`}>
                          {audienceLabel}
                        </span>

                        {/* Subcategory tag */}
                        {n.sub_category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                            🏷️ {n.sub_category}
                          </span>
                        )}

                        {/* Priority badge */}
                        {isUrgent ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                            🚨 Urgent
                          </span>
                        ) : isHigh ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                            ⚠️ High
                          </span>
                        ) : null}

                        <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
                          {formatDate(n.created_at || n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{n.message}</p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
                        <span>Dispatched by: <strong className="text-gray-600">{n.sender?.name || 'Administrator'}</strong></span>
                        {canSend && (
                          <button
                            onClick={() => handleDelete(n.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors font-medium hover:underline text-[11px]"
                          >
                            Delete Notice
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
