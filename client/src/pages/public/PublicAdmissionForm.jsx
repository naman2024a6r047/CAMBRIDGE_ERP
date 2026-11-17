import { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { generateAdmissionFormPDF } from '../../utils/pdfGenerator';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const CLASSES = [
  'Nursery',
  'Lower KG',
  'Upper KG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8'
];

const REQUIRED_DOCS = [
  'Birth Certificate (Age Proof)',
  'Passport Size Photographs (2)',
  'Previous School Report (if any)',
  'Aadhaar Card (Student & Parents)',
  'Address Proof'
];

export default function PublicAdmissionForm() {
  const [activeTab, setActiveTab] = useState('apply'); // 'apply' | 'status'
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Status check tab state
  const [searchFormNo, setSearchFormNo] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    student_name: '',
    date_of_birth: '',
    gender: 'Male',
    applying_class: 'Nursery',
    previous_school: '',
    aadhar_number: '',
    passport_photo: '',

    father_name: '',
    father_occupation: '',
    father_phone: '',
    father_whatsapp: '',
    mother_name: '',
    mother_occupation: '',
    mother_phone: '',
    mother_whatsapp: '',
    parent_email: '',

    residential_address: '',
    post_office_tehsil: '',
    district: 'Kishtwar',
    pin_code: '182205',

    enquiry_mode: 'Social Media',
    remarks: '',
    documents_submitted: [...REQUIRED_DOCS],
    declaration_agreed: true,
  });

  const [settings, setSettings] = useState({
    school_name: 'INTERNATIONAL CAMBRIDGE SCHOOL KISHTWAR',
    school_subtitle: 'Building Bright Futures',
    school_address: 'Ward No. 7, Shaheedi Mohallah, Kishtwar',
    school_logo_url: '',
  });

  useEffect(() => {
    // Fetch school branding settings
    axios.get(`${API_BASE}/public/admission/config`)
      .then(r => {
        if (r.data) {
          setSettings(prev => ({
            ...prev,
            school_name: r.data.school_name || prev.school_name,
            school_subtitle: r.data.school_subtitle || prev.school_subtitle,
            school_address: r.data.school_address || prev.school_address,
            school_logo_url: r.data.school_logo_url || prev.school_logo_url,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo size should be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, passport_photo: reader.result }));
      toast.success('Passport photo attached!');
    };
    reader.readAsDataURL(file);
  };

  const handleCopyFatherPhoneToWhatsapp = () => {
    setFormData(prev => ({ ...prev, father_whatsapp: prev.father_phone }));
    toast.success('Copied Father Phone to WhatsApp!');
  };

  const handleCopyMotherPhoneToWhatsapp = () => {
    setFormData(prev => ({ ...prev, mother_whatsapp: prev.mother_phone }));
    toast.success('Copied Mother Phone to WhatsApp!');
  };

  const toggleDocItem = (docItem) => {
    setFormData(prev => {
      const exists = prev.documents_submitted.includes(docItem);
      return {
        ...prev,
        documents_submitted: exists
          ? prev.documents_submitted.filter(d => d !== docItem)
          : [...prev.documents_submitted, docItem]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.student_name.trim()) {
      return toast.error('Student Name is required.');
    }
    if (!formData.father_name.trim() && !formData.mother_name.trim()) {
      return toast.error("Father's Name or Mother's Name is required.");
    }
    if (!formData.father_phone.trim() && !formData.mother_phone.trim()) {
      return toast.error('At least one phone number is required.');
    }
    if (!formData.declaration_agreed) {
      return toast.error('Please confirm the authenticity declaration.');
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/public/admission`, formData);
      setSubmittedData({
        ...res.data.data,
        form_no: res.data.form_no,
      });
      toast.success('Admission application submitted successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit admission application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    if (!searchFormNo.trim()) return toast.error('Please enter your Form Number.');

    setCheckingStatus(true);
    setStatusResult(null);
    try {
      const res = await axios.get(`${API_BASE}/public/admission/status/${encodeURIComponent(searchFormNo.trim())}`);
      setStatusResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Application not found with this Form Number.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const inputStyle = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400';
  const labelStyle = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />

      {/* Top Banner Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {settings.school_logo_url ? (
              <img src={settings.school_logo_url} alt="Logo" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-900 text-amber-300 font-extrabold flex items-center justify-center text-xs shadow-xs">
                ICS
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">International Cambridge School</p>
              <p className="text-[10px] text-slate-400">Shaheedi Mohallah, Kishtwar</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setActiveTab('apply'); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'apply' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              New Application
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('status'); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'status' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Check Status
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {/* Check Status Tab */}
        {activeTab === 'status' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-xl mx-auto">
            <div className="text-center mb-6">
              <span className="text-3xl">🔍</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">Track Admission Status</h2>
              <p className="text-xs text-slate-500 mt-1">Enter your Form Number (e.g. ICS-2026-0001) to view review status.</p>
            </div>

            <form onSubmit={handleCheckStatus} className="space-y-4">
              <div>
                <label className={labelStyle}>Form Reference Number *</label>
                <input
                  type="text"
                  value={searchFormNo}
                  onChange={(e) => setSearchFormNo(e.target.value.toUpperCase())}
                  placeholder="e.g. ICS-2026-0001"
                  className={inputStyle}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={checkingStatus}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                {checkingStatus ? 'Checking...' : 'Check Status'}
              </button>
            </form>

            {statusResult && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-400">Applicant</p>
                    <p className="text-sm font-bold text-slate-900">{statusResult.first_name} {statusResult.last_name === '.' ? '' : statusResult.last_name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    statusResult.status === 'approved' ? 'bg-green-100 text-green-800' :
                    statusResult.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {statusResult.status === 'pending' ? 'Pending Approval' : statusResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div><span className="text-slate-400">Class:</span> <strong className="text-slate-700">{statusResult.applying_class}</strong></div>
                  <div><span className="text-slate-400">Applied on:</span> <strong className="text-slate-700">{statusResult.application_date || statusResult.created_at?.slice(0, 10)}</strong></div>
                </div>

                {statusResult.status === 'approved' && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-xs text-green-800">
                    🎉 <strong>Congratulations!</strong> This admission has been approved by the school administration. Please visit the school office to complete formal enrollment.
                  </div>
                )}
                {statusResult.status === 'pending' && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800">
                    ⏳ <strong>Under Review:</strong> Your application has been logged and is queued for administrative review.
                  </div>
                )}
                {statusResult.status === 'rejected' && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-800">
                    ❌ <strong>Not Approved:</strong> {statusResult.review_notes || 'Please contact school administration for further guidance.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Application Submitted Success View */}
        {activeTab === 'apply' && submittedData && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
              ✓
            </div>

            <div>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Application Received
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-3">Admission Form Submitted!</h2>
              <p className="text-slate-500 text-sm mt-1">
                Your admission request has been recorded and submitted to the school administration for approval.
              </p>
            </div>

            {/* Reference Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-xs text-slate-500 uppercase font-semibold">Form Reference No.</span>
                <span className="text-lg font-black text-blue-700 tracking-wider font-mono">{submittedData.form_no}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Student Name</span>
                  <strong className="text-slate-800 text-sm">{submittedData.first_name} {submittedData.last_name === '.' ? '' : submittedData.last_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Class Applying For</span>
                  <strong className="text-slate-800 text-sm">{submittedData.applying_class}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Father / Guardian</span>
                  <strong className="text-slate-800">{submittedData.parent_name || submittedData.father_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Contact Phone</span>
                  <strong className="text-slate-800">{submittedData.parent_phone}</strong>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => generateAdmissionFormPDF(submittedData, settings)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📄</span>
                <span>Download / Print Form (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubmittedData(null);
                  setFormData(prev => ({
                    ...prev,
                    student_name: '',
                    passport_photo: '',
                    date_of_birth: '',
                    previous_school: '',
                    aadhar_number: '',
                    remarks: '',
                  }));
                }}
                className="px-5 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Submit Another Form
              </button>
            </div>

            {/* Immediate Help / Contacts */}
            <div className="border-t border-slate-100 pt-5 text-xs text-slate-500 text-center space-y-2">
              <p className="font-semibold text-slate-700">Need immediate assistance with admission?</p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://wa.me/917780959880?text=Hello%20Dr%20Arshad,%20I%20have%20submitted%20admission%20form"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100 transition-colors"
                >
                  <span>💬 WhatsApp: Dr Arshad Kichloo (7780959880)</span>
                </a>
                <a
                  href="https://wa.me/919797520072?text=Hello%20Mr%20Sumit,%20I%20have%20submitted%20admission%20form"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100 transition-colors"
                >
                  <span>💬 WhatsApp: Mr Sumit Kumar (9797520072)</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Admission Form */}
        {activeTab === 'apply' && !submittedData && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
            {/* Form Top Branding Header (Exact replica of physical form) */}
            <div className="p-6 sm:p-8 bg-gradient-to-b from-blue-50/50 to-white border-b border-slate-100">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-4">
                  {settings.school_logo_url ? (
                    <img src={settings.school_logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-full shadow-xs border border-slate-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-900 text-amber-300 font-black flex items-center justify-center text-xl shadow-md border-2 border-amber-400">
                      ICS
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                      International Cambridge School Kishtwar
                    </h1>
                    <p className="text-sm font-semibold text-blue-800 italic mt-0.5">Building Bright Futures</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl text-center">
                  <p className="text-[11px] font-bold text-amber-900 leading-tight">Quality Education</p>
                  <p className="text-[10px] text-amber-700">for a Brighter Tomorrow</p>
                </div>
              </div>

              {/* Title Banner */}
              <div className="mt-6 text-center">
                <div className="inline-block bg-blue-900 text-white font-extrabold text-sm sm:text-base px-6 py-2 rounded-xl shadow-sm tracking-wide">
                  ADMISSION FORM (Nursery – Class 8th)
                </div>
              </div>

              {/* 4 Feature Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                {[
                  { label: 'Quality Education', icon: '📚' },
                  { label: 'Holistic Development', icon: '🌟' },
                  { label: 'Safe & Supportive Environment', icon: '🛡️' },
                  { label: 'Bright Future', icon: '✨' },
                ].map((b) => (
                  <div key={b.label} className="bg-white/80 border border-slate-200 rounded-xl p-2 text-center text-xs font-semibold text-slate-700 shadow-2xs flex items-center justify-center gap-1.5">
                    <span>{b.icon}</span>
                    <span className="text-[11px]">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
              {/* ── 1. STUDENT DETAILS (Blue Header) ── */}
              <div>
                <div className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xs mb-4">
                  <span>👤</span>
                  <span>1. STUDENT DETAILS</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className={labelStyle}>Name of Student *</label>
                      <input
                        type="text"
                        name="student_name"
                        value={formData.student_name}
                        onChange={handleChange}
                        placeholder="Full student name"
                        className={inputStyle}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyle}>Date of Birth (DD/MM/YYYY) *</label>
                        <input
                          type="date"
                          name="date_of_birth"
                          value={formData.date_of_birth}
                          onChange={handleChange}
                          className={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelStyle}>Gender *</label>
                        <div className="flex gap-4 pt-2">
                          {['Male', 'Female', 'Other'].map(g => (
                            <label key={g} className="inline-flex items-center gap-1.5 text-sm cursor-pointer font-medium text-slate-700">
                              <input
                                type="radio"
                                name="gender"
                                value={g}
                                checked={formData.gender === g}
                                onChange={handleChange}
                                className="accent-blue-600"
                              />
                              <span>{g}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={labelStyle}>Class Applying For *</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
                        {CLASSES.map(cls => (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, applying_class: cls }))}
                            className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                              formData.applying_class === cls
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyle}>Previous School (if any)</label>
                        <input
                          type="text"
                          name="previous_school"
                          value={formData.previous_school}
                          onChange={handleChange}
                          placeholder="Previous school name"
                          className={inputStyle}
                        />
                      </div>
                      <div>
                        <label className={labelStyle}>Aadhaar No. (if available)</label>
                        <input
                          type="text"
                          name="aadhar_number"
                          value={formData.aadhar_number}
                          onChange={handleChange}
                          placeholder="12-digit Aadhaar number"
                          className={inputStyle}
                          maxLength={16}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Passport Photo Box (Top Right) */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl text-center">
                    {formData.passport_photo ? (
                      <div className="space-y-2">
                        <img
                          src={formData.passport_photo}
                          alt="Student Preview"
                          className="w-32 h-40 object-cover rounded-xl shadow-md border-2 border-blue-600 mx-auto"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, passport_photo: '' }))}
                          className="text-xs text-red-600 font-medium hover:underline block mx-auto"
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 py-4">
                        <div className="w-24 h-32 bg-slate-200 text-slate-400 rounded-xl flex flex-col items-center justify-center mx-auto border border-slate-300">
                          <span className="text-3xl">📷</span>
                          <span className="text-[10px] font-bold mt-1 text-slate-500">3.5 × 4.5 cm</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700">Paste / Upload Photo</p>
                        <p className="text-[10px] text-slate-400">Recent Passport Size Photograph</p>
                        <label className="inline-block mt-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                          Browse Image
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 2. PARENTAGE DETAILS (Pink/Rose Header) ── */}
              <div>
                <div className="bg-rose-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xs mb-4">
                  <span>👨‍👩‍👧</span>
                  <span>2. PARENTAGE DETAILS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>Father's Name *</label>
                    <input
                      type="text"
                      name="father_name"
                      value={formData.father_name}
                      onChange={handleChange}
                      placeholder="Father's full name"
                      className={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>Father's Occupation</label>
                    <input
                      type="text"
                      name="father_occupation"
                      value={formData.father_occupation}
                      onChange={handleChange}
                      placeholder="Business / Service / Agriculture"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Father's Phone No. *</label>
                    <input
                      type="tel"
                      name="father_phone"
                      value={formData.father_phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile number"
                      className={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-600">Father's WhatsApp No.</label>
                      <button
                        type="button"
                        onClick={handleCopyFatherPhoneToWhatsapp}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        Same as Phone
                      </button>
                    </div>
                    <input
                      type="tel"
                      name="father_whatsapp"
                      value={formData.father_whatsapp}
                      onChange={handleChange}
                      placeholder="WhatsApp contact number"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Mother's Name</label>
                    <input
                      type="text"
                      name="mother_name"
                      value={formData.mother_name}
                      onChange={handleChange}
                      placeholder="Mother's full name"
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>Mother's Occupation</label>
                    <input
                      type="text"
                      name="mother_occupation"
                      value={formData.mother_occupation}
                      onChange={handleChange}
                      placeholder="Homemaker / Service"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Mother's Phone No.</label>
                    <input
                      type="tel"
                      name="mother_phone"
                      value={formData.mother_phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile number"
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-600">Mother's WhatsApp No.</label>
                      <button
                        type="button"
                        onClick={handleCopyMotherPhoneToWhatsapp}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        Same as Phone
                      </button>
                    </div>
                    <input
                      type="tel"
                      name="mother_whatsapp"
                      value={formData.mother_whatsapp}
                      onChange={handleChange}
                      placeholder="WhatsApp contact number"
                      className={inputStyle}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Email Address (Optional)</label>
                    <input
                      type="email"
                      name="parent_email"
                      value={formData.parent_email}
                      onChange={handleChange}
                      placeholder="parent@example.com"
                      className={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* ── 3. ADDRESS DETAILS (Teal Header) ── */}
              <div>
                <div className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xs mb-4">
                  <span>📍</span>
                  <span>3. ADDRESS DETAILS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Residential Address *</label>
                    <textarea
                      name="residential_address"
                      value={formData.residential_address}
                      onChange={handleChange}
                      rows={2}
                      placeholder="House / Street / Mohallah name"
                      className={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Post Office / Tehsil</label>
                    <input
                      type="text"
                      name="post_office_tehsil"
                      value={formData.post_office_tehsil}
                      onChange={handleChange}
                      placeholder="e.g. Kishtwar"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>District</label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      placeholder="Kishtwar"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Pin Code</label>
                    <input
                      type="text"
                      name="pin_code"
                      value={formData.pin_code}
                      onChange={handleChange}
                      placeholder="182205"
                      className={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* ── 4. OTHER DETAILS (Indigo Header) ── */}
              <div>
                <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xs mb-4">
                  <span>📋</span>
                  <span>4. OTHER DETAILS &amp; DOCUMENTS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>Date of Application</label>
                    <input
                      type="text"
                      value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                      disabled
                      className={`${inputStyle} bg-slate-100 text-slate-500`}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Mode of Enquiry</label>
                    <select
                      name="enquiry_mode"
                      value={formData.enquiry_mode}
                      onChange={handleChange}
                      className={inputStyle}
                    >
                      <option value="Newspaper">Newspaper</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Reference">Reference / Friend / Family</option>
                      <option value="School Visit">School Visit</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Remarks (if any)</label>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Any health conditions, special requests, or extra information"
                      className={inputStyle}
                    />
                  </div>
                </div>

                {/* Documents Checklist Information (matching physical form) */}
                <div className="mt-5 bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span>📌</span>
                    <span>Documents Required (at the time of admission):</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {REQUIRED_DOCS.map(doc => {
                      const checked = formData.documents_submitted.includes(doc);
                      return (
                        <label
                          key={doc}
                          onClick={() => toggleDocItem(doc)}
                          className={`text-xs p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                            checked ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold' : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="accent-amber-600"
                          />
                          <span>{doc}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Declaration Agreement */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      name="declaration_agreed"
                      checked={formData.declaration_agreed}
                      onChange={handleChange}
                      className="accent-blue-600 mt-0.5"
                    />
                    <span>
                      I hereby declare that all entries filled in this admission form are true and accurate. I agree to abide by the rules and regulations of International Cambridge School Kishtwar and will submit original certificates upon formal admission.
                    </span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold py-3.5 px-6 rounded-2xl text-base shadow-md transition-all hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>Submit Admission Form</span>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Footer Strip (Exact replica of physical form) */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <p className="font-semibold text-slate-200">📍 Ward No. 7, Shaheedi Mohallah, Kishtwar</p>
                <p className="text-[11px] text-amber-300 italic mt-0.5">Your Child's Bright Future, Our Priority</p>
              </div>
              <div className="text-right text-[11px] text-slate-300 space-y-0.5">
                <p>📞 Dr Arshad Kichloo: <strong>7780959880</strong></p>
                <p>📞 Mr Sumit Kumar: <strong>9797520072</strong></p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
