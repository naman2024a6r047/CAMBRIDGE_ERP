import { useState, useEffect } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    school_name: '',
    school_subtitle: '',
    school_address: '',
    school_phone: '',
    school_email: '',
    school_logo_url: '',
    receipt_footer: '',
    dise_code: '',
    school_established: '',
    school_medium: 'ENGLISH MEDIUM',
    academic_session: '2024 - 2025',
    school_reopen_date: '01 APRIL 2025',
    school_motto_1: 'Play',
    school_motto_2: 'Learn',
    school_motto_3: 'Grow',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Admin Password Change State
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    API.get('/settings')
      .then(res => {
        setSettings(prev => ({ ...prev, ...res.data }));
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.put('/settings', settings);
      toast.success('Settings and School ID saved successfully!');
      // Force reload to apply settings everywhere immediately
      window.location.reload();
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    const oldPass = passwordForm.oldPassword.trim();
    const newPass = passwordForm.newPassword.trim();
    const confPass = passwordForm.confirmPassword.trim();

    if (!oldPass) {
      return toast.error('Please enter your current (old) password.');
    }
    if (!newPass) {
      return toast.error('Please enter a new password.');
    }
    if (newPass.length < 6) {
      return toast.error('New password must be at least 6 characters long.');
    }
    if (newPass !== confPass) {
      return toast.error('New password and Confirm Password do not match.');
    }
    if (oldPass === newPass) {
      return toast.error('New password must be different from your old password.');
    }

    setUpdatingPassword(true);
    try {
      const res = await API.put('/settings/change-password', {
        currentPassword: oldPass,
        oldPassword: oldPass,
        newPassword: newPass,
        confirmPassword: confPass,
      });

      toast.success(res.data?.message || 'Admin password changed successfully!');
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to update password. Please check your old password.';
      toast.error(errorMsg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">School Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage school profile, receipts, branding, and administrator security</p>
      </div>

      {/* ── 1. School Profile & Report Card Settings ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-sm font-semibold text-gray-700">School Name</label>
              <input
                type="text"
                name="school_name"
                value={settings.school_name || ''}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. International Cambridge School Kishtwar"
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="text-sm font-semibold text-gray-700">School Subtitle</label>
              <input
                type="text"
                name="school_subtitle"
                value={settings.school_subtitle || ''}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. Kishtwar, Jammu & Kashmir"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700">School Address</label>
              <textarea
                name="school_address"
                value={settings.school_address || ''}
                onChange={handleChange}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="Full address to display on receipts and certificates"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Phone Number</label>
              <input
                type="text"
                name="school_phone"
                value={settings.school_phone || ''}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="+1 234 567 890"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Email Address</label>
              <input
                type="email"
                name="school_email"
                value={settings.school_email || ''}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="info@school.com"
              />
            </div>

            {/* Logo Image Upload */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700">School Logo</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {settings.school_logo_url && (
                  <img 
                    src={settings.school_logo_url} 
                    alt="Logo preview" 
                    className="h-12 w-12 object-contain rounded border border-gray-200 bg-white"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_SIZE = 200;
                        
                        if (width > height) {
                          if (width > MAX_SIZE) {
                            height = Math.round(height * (MAX_SIZE / width));
                            width = MAX_SIZE;
                          }
                        } else {
                          if (height > MAX_SIZE) {
                            width = Math.round(width * (MAX_SIZE / height));
                            height = MAX_SIZE;
                          }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const base64Str = canvas.toDataURL('image/webp', 0.8);
                        setSettings(prev => ({ ...prev, school_logo_url: base64Str }));
                        toast.success('Logo preview loaded! Click Save Settings to apply.');
                      };
                      img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Receipt Footer Note</label>
              <input
                type="text"
                name="receipt_footer"
                value={settings.receipt_footer || ''}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="This is a computer-generated receipt."
              />
            </div>

            {/* Official Report Card & Certificate Settings */}
            <div className="space-y-4 sm:col-span-2 pt-4 border-t border-gray-200">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Official Report Card & Marksheet Customization
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Customize marksheet headers, DICE code, estd year, motto, and academic session</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">DICE / UDISE No.</label>
                  <input
                    type="text"
                    name="dise_code"
                    value={settings.dise_code || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. 23320400828"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Actual School Estd. Date / Year</label>
                  <input
                    type="text"
                    name="school_established"
                    value={settings.school_established || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. 2012 or 15 August 2012"
                  />
                  <p className="text-[10px] text-gray-400">Printed as ESTD. on official marksheets & seals</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Medium of Instruction</label>
                  <input
                    type="text"
                    name="school_medium"
                    value={settings.school_medium || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. ENGLISH MEDIUM"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Academic Session</label>
                  <input
                    type="text"
                    name="academic_session"
                    value={settings.academic_session || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. 2024 - 2025"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">School Reopen Date</label>
                  <input
                    type="text"
                    name="school_reopen_date"
                    value={settings.school_reopen_date || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="e.g. 01 APRIL 2025"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Badge Motto (3 Words)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="text"
                      name="school_motto_1"
                      value={settings.school_motto_1 || ''}
                      onChange={handleChange}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500 text-center"
                      placeholder="Play"
                    />
                    <input
                      type="text"
                      name="school_motto_2"
                      value={settings.school_motto_2 || ''}
                      onChange={handleChange}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500 text-center"
                      placeholder="Learn"
                    />
                    <input
                      type="text"
                      name="school_motto_3"
                      value={settings.school_motto_3 || ''}
                      onChange={handleChange}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500 text-center"
                      placeholder="Grow"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* ── 2. Admin Security & Password Change ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg border border-amber-200">
              🔒
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Change Admin Password</h3>
              <p className="text-xs text-gray-500">
                To update your password, your current (old) password is required first to verify your identity.
              </p>
            </div>
          </div>

          {user?.email && (
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {user.email}
            </span>
          )}
        </div>

        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
            <span className="text-blue-600 font-bold">ℹ️</span>
            <span>
              Your new password will only be saved if the <strong>old password matches</strong> your current admin account password.
            </span>
          </div>

          {/* Old / Current Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Current (Old) Password *
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? 'text' : 'password'}
                name="oldPassword"
                value={passwordForm.oldPassword}
                onChange={handlePasswordFormChange}
                placeholder="Enter current password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium cursor-pointer"
              >
                {showOldPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Required to verify your authorization.</p>
          </div>

          {/* New Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Min. 6 characters"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium cursor-pointer"
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Re-enter new password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium cursor-pointer"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={updatingPassword}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔒</span>
              <span>{updatingPassword ? 'Verifying & Saving...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
