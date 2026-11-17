import { useState, useEffect } from 'react';
import API from '../utils/api';
import SearchBar from '../components/common/SearchBar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function generateRandomPassword() {
  const prefixes = ['Camp', 'Sch', 'Edu', 'Pass', 'Login', 'Teach'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}@${num}`;
}

export default function CredentialManagement() {
  const { user } = useAuth();
  
  // Tab control based on role
  const isAdmin = user?.role === 'admin' || user?.role === 'admin2' || user?.role === 'superadmin' || user?.role === 'super_admin';
  const isFC = user?.role === 'fee_collector';
  
  const [activeTab, setActiveTab] = useState(isAdmin ? 'teachers' : 'students');
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSendEmail, setEditSendEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [savingId, setSavingId] = useState(null);
  
  // Modal state for "Send Credentials"
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTargetUser, setSendTargetUser] = useState(null);
  const [sendPasswordMode, setSendPasswordMode] = useState('generate'); // 'generate' | 'custom' | 'keep'
  const [generatedPass, setGeneratedPass] = useState('');
  const [customPass, setCustomPass] = useState('');
  const [showCustomPass, setShowCustomPass] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  // Tracks email delivery status per row ID: 'idle' | 'success' | 'queued' | 'failed'
  const [mailStatuses, setMailStatuses] = useState({});

  // Fetch users based on active tab
  const fetchCredentials = async (query = '') => {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'teachers') endpoint = '/credentials/teachers';
      else if (activeTab === 'fee_collectors') endpoint = '/credentials/fee-collectors';
      else if (activeTab === 'students') endpoint = '/credentials/students';
      
      const res = await API.get(`${endpoint}?search=${query}`);
      setUsersList(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cancelEdit();
    closeSendModal();
    fetchCredentials(searchQuery);
  }, [activeTab]);

  const handleSearch = (q) => {
    setSearchQuery(q);
    fetchCredentials(q);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditEmail(row.email);
    setEditPassword('');
    setEditSendEmail(true);
    setShowPassword(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEmail('');
    setEditPassword('');
    setShowPassword(false);
  };

  const saveCredentials = async (rowId) => {
    if (!editEmail.trim()) {
      toast.error('Login ID / Email cannot be empty.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (editPassword && editPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setSavingId(rowId);
    try {
      const payload = { 
        email: editEmail,
        sendEmail: editSendEmail
      };
      if (editPassword.trim()) {
        payload.password = editPassword;
      }

      const res = await API.put(`/credentials/${rowId}`, payload);
      
      // Update local row
      setUsersList(prev => prev.map(u => u.id === rowId ? { ...u, email: editEmail } : u));
      
      if (res.data.emailSent) {
        toast.success(res.data.message || 'Credentials updated and email delivered!');
        setMailStatuses(prev => ({ ...prev, [rowId]: 'success' }));
      } else if (res.data.emailQueued) {
        toast.success('Credentials saved! Email notification dispatching in background.');
        setMailStatuses(prev => ({ ...prev, [rowId]: 'queued' }));
      } else {
        toast.success(res.data.message || 'Credentials updated successfully.');
        setMailStatuses(prev => ({ ...prev, [rowId]: 'saved' }));
      }
      
      cancelEdit();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save credentials.');
    } finally {
      setSavingId(null);
    }
  };

  // Open "Send Credentials" Modal
  const openSendModal = (row) => {
    setSendTargetUser(row);
    setSendPasswordMode('generate');
    setGeneratedPass(generateRandomPassword());
    setCustomPass('');
    setShowCustomPass(false);
    setSendModalOpen(true);
  };

  const closeSendModal = () => {
    setSendModalOpen(false);
    setSendTargetUser(null);
    setGeneratedPass('');
    setCustomPass('');
  };

  // Dispatch Credentials Email
  const submitSendCredentials = async () => {
    if (!sendTargetUser) return;
    const rowId = sendTargetUser.id;

    if (sendPasswordMode === 'custom' && customPass.trim().length < 6) {
      toast.error('Custom password must be at least 6 characters.');
      return;
    }

    setSendingEmailId(rowId);
    try {
      const payload = {
        generateNew: sendPasswordMode === 'generate',
        password: sendPasswordMode === 'custom' ? customPass.trim() : (sendPasswordMode === 'generate' ? generatedPass : null),
        keepCurrent: sendPasswordMode === 'keep'
      };

      const res = await API.post(`/credentials/${rowId}/send`, payload);

      if (res.data.emailSent) {
        toast.success(res.data.message || `Credentials sent to ${sendTargetUser.email}!`);
        setMailStatuses(prev => ({ ...prev, [rowId]: 'success' }));
      } else if (res.data.emailQueued) {
        toast.success(`Credentials saved! Email is dispatching to ${sendTargetUser.email} in background.`);
        setMailStatuses(prev => ({ ...prev, [rowId]: 'queued' }));
      } else {
        toast(res.data.message || 'Credentials updated, but SMTP delivery could not complete.', { icon: '⚠️' });
        setMailStatuses(prev => ({ ...prev, [rowId]: 'failed' }));
      }

      closeSendModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send credentials.');
    } finally {
      setSendingEmailId(null);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Password copied to clipboard!');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      
      {/* Header section */}
      <div className="border-b border-gray-100 bg-gray-50/50 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Credential Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage system login IDs, set secure passwords, and trigger instant email credentials dispatch.</p>
        </div>

        {/* Tab Controls */}
        {isAdmin && (
          <div className="flex bg-gray-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('teachers')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'teachers' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Teachers
            </button>
            <button
              onClick={() => setActiveTab('fee_collectors')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'fee_collectors' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Fee Collectors
            </button>
          </div>
        )}

        {isFC && (
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-semibold">
            Students Tab Active
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Search Controls */}
        <div className="max-w-md">
          <SearchBar
            placeholder={`Search by name, login email, or phone...`}
            onChange={handleSearch}
          />
        </div>

        {/* Credentials Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Contact Phone</th>
                <th className="px-6 py-4">Login ID (Username)</th>
                <th className="px-6 py-4">Password</th>
                <th className="px-6 py-4 text-center">Email Delivery Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <LoadingSpinner />
                      <span className="text-xs text-gray-400">Loading credentials list...</span>
                    </div>
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400 text-sm">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                usersList.map((row) => {
                  const isEditing = editingId === row.id;
                  const isSaving = savingId === row.id;
                  const isSending = sendingEmailId === row.id;
                  const mailStatus = mailStatuses[row.id] || 'idle';
                  
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      
                      {/* Name */}
                      <td className="px-6 py-4 font-medium text-gray-800">{row.name}</td>
                      
                      {/* Role */}
                      <td className="px-6 py-4 capitalize">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${
                          row.role === 'teacher' ? 'bg-indigo-50 text-indigo-700' :
                          row.role === 'fee_collector' ? 'bg-orange-50 text-orange-700' :
                          'bg-emerald-50 text-emerald-700'
                        }`}>
                          {row.role?.replace('_', ' ')}
                        </span>
                      </td>
                      
                      {/* Contact Phone */}
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{row.phone || '—'}</td>
                      
                      {/* Login ID Input / Display */}
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            placeholder="Enter login ID (email)"
                          />
                        ) : (
                          <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-md font-medium">
                            {row.email}
                          </span>
                        )}
                      </td>
                      
                      {/* Password Input / Display */}
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                placeholder="Enter new password (optional)"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                              >
                                {showPassword ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={editSendEmail}
                                onChange={(e) => setEditSendEmail(e.target.checked)}
                                className="rounded text-blue-600 text-xs"
                              />
                              <span>Send credentials email on save</span>
                            </label>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono text-xs select-none">••••••••</span>
                        )}
                      </td>
                      
                      {/* Email Delivery Status Badge */}
                      <td className="px-6 py-4 text-center">
                        {mailStatus === 'success' && (
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            Email Sent
                          </span>
                        )}
                        {mailStatus === 'queued' && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            Email Dispatched
                          </span>
                        )}
                        {mailStatus === 'saved' && (
                          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                            Saved (Local)
                          </span>
                        )}
                        {mailStatus === 'failed' && (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Delivery Issue
                          </span>
                        )}
                        {mailStatus === 'idle' && (
                          <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                            Not Sent Yet
                          </span>
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => saveCredentials(row.id)}
                              disabled={isSaving}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isSaving ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <span>Save</span>
                              )}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* Send Credentials Button */}
                            <button
                              onClick={() => openSendModal(row)}
                              disabled={isSending}
                              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                              title="Send login credentials to user's email"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span>Send Credentials</span>
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => startEdit(row)}
                              className="text-gray-700 hover:text-blue-600 text-xs font-semibold bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal: Send Credentials to Staff / User */}
      {sendModalOpen && sendTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-blue-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Send Credentials</h3>
                  <p className="text-xs text-blue-100">Send login details directly to recipient email</p>
                </div>
              </div>
              <button
                onClick={closeSendModal}
                disabled={Boolean(sendingEmailId)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              
              {/* Recipient Details Card */}
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Recipient Name:</span>
                  <span className="font-semibold text-gray-800">{sendTargetUser.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Assigned Role:</span>
                  <span className="capitalize font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {sendTargetUser.role?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Destination Email (Login ID):</span>
                  <span className="font-mono text-gray-800 font-semibold">{sendTargetUser.email}</span>
                </div>
                {sendTargetUser.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Contact Phone:</span>
                    <span className="font-mono text-gray-600">{sendTargetUser.phone}</span>
                  </div>
                )}
              </div>

              {/* Password Option Selection */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-gray-700 block">Choose Password to Send:</label>
                
                {/* Option 1: Auto-generate */}
                <div 
                  onClick={() => setSendPasswordMode('generate')}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    sendPasswordMode === 'generate' 
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                    <input
                      type="radio"
                      name="passwordMode"
                      checked={sendPasswordMode === 'generate'}
                      onChange={() => setSendPasswordMode('generate')}
                      className="text-blue-600"
                    />
                    <span>Generate New Temporary Password</span>
                  </label>

                  {sendPasswordMode === 'generate' && (
                    <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500">Password:</span>
                        <code className="bg-white border border-blue-200 px-2.5 py-1 rounded-md text-xs font-mono font-bold text-blue-700">
                          {generatedPass}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGeneratedPass(generateRandomPassword());
                          }}
                          className="text-[11px] bg-white border border-gray-200 hover:bg-gray-50 px-2 py-1 rounded text-gray-600"
                          title="Generate different password"
                        >
                          🔄 New
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(generatedPass);
                          }}
                          className="text-[11px] bg-white border border-gray-200 hover:bg-gray-50 px-2 py-1 rounded text-gray-600"
                          title="Copy password"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Custom Password */}
                <div 
                  onClick={() => setSendPasswordMode('custom')}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    sendPasswordMode === 'custom' 
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                    <input
                      type="radio"
                      name="passwordMode"
                      checked={sendPasswordMode === 'custom'}
                      onChange={() => setSendPasswordMode('custom')}
                      className="text-blue-600"
                    />
                    <span>Set Specific Custom Password</span>
                  </label>

                  {sendPasswordMode === 'custom' && (
                    <div className="mt-2.5 pt-2 border-t border-blue-100 space-y-1.5">
                      <div className="relative">
                        <input
                          type={showCustomPass ? 'text' : 'password'}
                          value={customPass}
                          onChange={(e) => setCustomPass(e.target.value)}
                          placeholder="Type password (min 6 characters)"
                          className="w-full bg-white border border-gray-300 rounded-lg pl-3 pr-12 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCustomPass(!showCustomPass)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 hover:text-gray-700"
                        >
                          {showCustomPass ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 3: Keep Current Password */}
                <div 
                  onClick={() => setSendPasswordMode('keep')}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    sendPasswordMode === 'keep' 
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                    <input
                      type="radio"
                      name="passwordMode"
                      checked={sendPasswordMode === 'keep'}
                      onChange={() => setSendPasswordMode('keep')}
                      className="text-blue-600"
                    />
                    <span>Keep Existing Password (Send Portal Link & Login ID Only)</span>
                  </label>
                  {sendPasswordMode === 'keep' && (
                    <p className="mt-1 text-[11px] text-gray-500 pl-5">
                      Does not alter current password. The recipient receives login instructions and their Login ID.
                    </p>
                  )}
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeSendModal}
                disabled={Boolean(sendingEmailId)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSendCredentials}
                disabled={Boolean(sendingEmailId)}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {sendingEmailId ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Sending Credentials...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Send Credentials Now</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
