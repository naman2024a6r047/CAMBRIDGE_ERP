import { useState, useEffect } from 'react';
import API from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Modal from '../../components/common/Modal';
import Avatar from '../../components/common/Avatar';
import toast from 'react-hot-toast';
import { generateAdmissionFormPDF } from '../../utils/pdfGenerator';
import StudentFeeWidget from '../../components/common/StudentFeeWidget';

const statusColor = {
  pending:      'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-blue-100 text-blue-800 border-blue-200',
  approved:     'bg-green-100 text-green-800 border-green-200',
  rejected:     'bg-red-100 text-red-800 border-red-200',
};

export default function FCAdmissions() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [search, setSearch]     = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewing, setViewing] = useState(null);

  // Approval Dialog Options
  const [approveSection, setApproveSection] = useState('A');
  const [approveRollNo, setApproveRollNo] = useState('');
  const [approving, setApproving] = useState(false);

  const publicUrl = `${window.location.origin}/admission`;

  const load = () => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : '';
    API.get(`/fc/admission-requests${q}`)
      .then(r => setRequests(r.data))
      .catch(() => toast.error('Failed to load admission requests.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Public Admission Form link copied to clipboard!');
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*Admission Open (Nursery to Class 8th)*\n` +
      `International Cambridge School Kishtwar\n\n` +
      `Fill the online admission form here:\n${publicUrl}\n\n` +
      `Contact:\nDr Arshad Kichloo: 7780959880\nMr Sumit Kumar: 9797520072`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleAction = async (id, status) => {
    const notes = status === 'rejected'
      ? prompt('Reason for rejection:')
      : 'Approved by admin.';
    if (status === 'rejected' && !notes) return;

    setApproving(true);
    try {
      const idStr = String(id);
      if (idStr.startsWith('student-')) {
        const studentId = idStr.replace('student-', '');
        await API.put(`/students/${studentId}/approval`, { status, rejection_reason: notes });
      } else {
        await API.put(`/fc/admission-requests/${id}`, {
          status,
          review_notes: notes,
          section: approveSection,
          roll_number: approveRollNo || null,
        });
      }
      toast.success(`Admission request ${status}!`);
      setShowViewModal(false);
      setViewing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed.');
    } finally {
      setApproving(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const fullName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    const formNo = (r.form_no || '').toLowerCase();
    const phone = (r.parent_phone || r.father_phone || '').toLowerCase();
    const cls = (r.applying_class || '').toLowerCase();
    return fullName.includes(term) || formNo.includes(term) || phone.includes(term) || cls.includes(term);
  });

  return (
    <div className="space-y-5">
      {/* ── Public Admission Form Share Banner ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Public Portal
            </span>
            <span className="text-amber-300 text-xs font-semibold">Shareable With Parents</span>
          </div>
          <h2 className="text-base sm:text-lg font-black tracking-tight">Public Online Admission Form</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Parents can submit admission applications online via this link without logging in. All submissions queue directly here for your administrative review and approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>📋</span>
            <span>Copy Link</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>💬</span>
            <span>WhatsApp</span>
          </button>

          <a
            href="/admission"
            target="_blank"
            rel="noreferrer"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
          >
            <span>↗ Open Form</span>
          </a>
        </div>
      </div>

      {/* ── Header & Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Admissions &amp; Approvals</h2>
          <p className="text-gray-400 text-xs">{filteredRequests.length} applications found ({requests.filter(r => r.status === 'pending').length} pending)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student, form #, phone..."
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 bg-white flex-1 sm:w-60 shadow-2xs"
          />

          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 bg-white shadow-2xs"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* ── Requests Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-gray-400 text-sm">Loading applications...</p>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <span className="text-3xl">📭</span>
            <p className="text-gray-500 font-semibold text-sm">No admission applications found.</p>
            <p className="text-gray-400 text-xs">Share the public link to allow parents to apply online.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: 700 }}>
              <thead className="bg-slate-50 border-b border-gray-100 text-gray-500 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Form #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Parent Details</th>
                  <th className="py-3 px-4">Applied On</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRequests.map(r => {
                  const studentName = `${r.first_name || ''} ${r.last_name === '.' ? '' : (r.last_name || '')}`.trim();
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900 whitespace-nowrap">
                        {r.form_no || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {(r.passport_photo || r.profile_photo) ? (
                            <img
                              src={r.passport_photo || r.profile_photo}
                              alt={studentName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <Avatar name={studentName} size="sm" />
                          )}
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{studentName}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{r.gender || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {r.applying_class}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-700">{r.parent_name || r.father_name || '—'}</p>
                        <p className="text-gray-400 font-mono text-[10px]">{r.parent_phone || r.father_phone || '—'}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                        {formatDate(r.application_date || r.created_at || r.createdAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.source === 'public_portal' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.source === 'public_portal' ? 'Online Form' : 'Staff Entry'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setViewing(r);
                              setApproveSection('A');
                              setApproveRollNo('');
                              setShowViewModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Review
                          </button>

                          <button
                            type="button"
                            onClick={() => generateAdmissionFormPDF(r, settings)}
                            className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Download Official Form PDF"
                          >
                            📄 PDF
                          </button>

                          {r.status === 'pending' && (user?.role === 'admin' || user?.role === 'admin2') && (
                            <button
                              type="button"
                              onClick={() => {
                                setViewing(r);
                                setShowViewModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Review & Approval Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewing(null); }}
        title={`Admission Application — ${viewing?.form_no || 'Details'}`}
        size="lg"
      >
        {viewing && (
          <div className="space-y-5 text-xs text-slate-700 max-h-[80vh] overflow-y-auto pr-1">
            {/* Top Identity Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-3.5">
                {(viewing.passport_photo || viewing.profile_photo) ? (
                  <img
                    src={viewing.passport_photo || viewing.profile_photo}
                    alt="Passport Photo"
                    className="w-16 h-20 rounded-xl object-cover border-2 border-blue-600 shadow-xs"
                  />
                ) : (
                  <Avatar name={`${viewing.first_name} ${viewing.last_name}`} size="lg" />
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewing.first_name} {viewing.last_name === '.' ? '' : viewing.last_name}
                  </h3>
                  <p className="text-slate-500 font-mono text-[11px]">Form No: <strong>{viewing.form_no || 'N/A'}</strong></p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusColor[viewing.status]}`}>
                      {viewing.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Applied: {formatDate(viewing.application_date || viewing.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => generateAdmissionFormPDF(viewing, settings)}
                className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📄</span>
                <span>Print Official Form (PDF)</span>
              </button>
            </div>

            {/* 1. Student Details */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-blue-600 text-white px-3.5 py-1.5 font-bold text-[11px]">
                1. STUDENT DETAILS
              </div>
              <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-slate-400 font-medium">Class Applying For</p>
                  <p className="font-bold text-blue-900 text-sm">{viewing.applying_class}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Date of Birth</p>
                  <p className="font-semibold">{viewing.date_of_birth ? formatDate(viewing.date_of_birth) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Gender</p>
                  <p className="font-semibold">{viewing.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Previous School</p>
                  <p className="font-semibold">{viewing.previous_school || 'None'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Aadhaar Number</p>
                  <p className="font-semibold font-mono">{viewing.aadhar_number || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* 2. Parentage Details */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-rose-600 text-white px-3.5 py-1.5 font-bold text-[11px]">
                2. PARENTAGE DETAILS
              </div>
              <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-slate-400 font-medium">Father's Name</p>
                  <p className="font-semibold">{viewing.father_name || viewing.parent_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Father's Occupation</p>
                  <p className="font-semibold">{viewing.father_occupation || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Father's Phone / WhatsApp</p>
                  <p className="font-semibold font-mono">
                    {viewing.father_phone || viewing.parent_phone || 'N/A'}
                    {viewing.father_whatsapp ? ` (WA: ${viewing.father_whatsapp})` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Mother's Name</p>
                  <p className="font-semibold">{viewing.mother_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Mother's Occupation</p>
                  <p className="font-semibold">{viewing.mother_occupation || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Mother's Phone</p>
                  <p className="font-semibold font-mono">{viewing.mother_phone || 'N/A'}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-slate-400 font-medium">Email Address</p>
                  <p className="font-semibold">{viewing.parent_email || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* 3. Address & Other Details */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-teal-600 text-white px-3.5 py-1.5 font-bold text-[11px]">
                3. ADDRESS &amp; ENQUIRY DETAILS
              </div>
              <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-slate-400 font-medium">Residential Address</p>
                  <p className="font-semibold">{viewing.residential_address || viewing.parent_address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Post Office / Tehsil</p>
                  <p className="font-semibold">{viewing.post_office_tehsil || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">District</p>
                  <p className="font-semibold">{viewing.district || 'Kishtwar'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Pin Code</p>
                  <p className="font-semibold font-mono">{viewing.pin_code || '182205'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Mode of Enquiry</p>
                  <p className="font-semibold">{viewing.enquiry_mode || 'Online Portal'}</p>
                </div>
                {viewing.remarks && (
                  <div className="col-span-2">
                    <p className="text-slate-400 font-medium">Remarks</p>
                    <p className="font-semibold italic text-slate-600">{viewing.remarks}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Enrolled Student Fee Status if Already Approved */}
            {viewing.student_id_created && (
              <div className="border border-slate-200 rounded-xl overflow-hidden p-3.5 bg-slate-50">
                <p className="text-xs font-bold text-slate-800 mb-2">Student Enrolled in ERP</p>
                <StudentFeeWidget studentId={viewing.student_id_created} />
              </div>
            )}

            {/* Admin Approval Decision Controls */}
            {viewing.status === 'pending' && (user?.role === 'admin' || user?.role === 'admin2') && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-green-900 flex items-center gap-1.5">
                  <span>🎓</span>
                  <span>Administrative Admission Approval</span>
                </p>
                <p className="text-[11px] text-green-800">
                  Approving this request will create the student's official profile, assign login credentials, and sync the class fee structure automatically.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-green-900 mb-1">Assign Section *</label>
                    <select
                      value={approveSection}
                      onChange={(e) => setApproveSection(e.target.value)}
                      className="w-full bg-white border border-green-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                      <option value="D">Section D</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-green-900 mb-1">Roll Number (Optional)</label>
                    <input
                      type="number"
                      value={approveRollNo}
                      onChange={(e) => setApproveRollNo(e.target.value)}
                      placeholder="Auto if left blank"
                      className="w-full bg-white border border-green-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={approving}
                    onClick={() => handleAction(viewing.id, 'approved')}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>✓</span>
                    <span>{approving ? 'Processing...' : 'Approve & Create Student'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={approving}
                    onClick={() => handleAction(viewing.id, 'rejected')}
                    className="px-4 bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
