import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import NotificationDetailModal from '../../components/common/NotificationDetailModal';
import { getNotificationDestination } from '../../utils/notificationNavigation';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const typeStyle = {
  fee_reminder:     { icon: '💳', badge: 'bg-yellow-100 text-yellow-800' },
  attendance_alert: { icon: '⏰', badge: 'bg-red-100 text-red-700' },
  result:           { icon: '📊', badge: 'bg-blue-100 text-blue-700' },
  holiday:          { icon: '🌴', badge: 'bg-green-100 text-green-700' },
  general:          { icon: '📢', badge: 'bg-gray-100 text-gray-700' },
  academic:         { icon: '📚', badge: 'bg-indigo-100 text-indigo-700' },
  exam_datesheet:   { icon: '📅', badge: 'bg-purple-100 text-purple-700' },
  achievement:      { icon: '🏆', badge: 'bg-amber-100 text-amber-800' },
  emergency:        { icon: '🚨', badge: 'bg-rose-100 text-rose-800' },
};

export default function MyNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('all');
  const [selectedNotif, setSelectedNotif] = useState(null);

  useEffect(() => {
    API.get('/notifications')
      .then(r => setNotifs(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Failed to load notifications.'))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await API.post(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = () => {
    notifs.filter(n => !n.is_read).forEach(n => markRead(n.id));
    toast.success('All notifications marked as read.');
  };

  const unread = notifs.filter(n => !n.is_read).length;

  const filteredNotifs = useMemo(() => {
    if (activeTab === 'all') return notifs;
    if (activeTab === 'urgent') return notifs.filter(n => n.priority === 'urgent');
    if (activeTab === 'fees') return notifs.filter(n => n.type === 'fee_reminder' || n.sub_category?.toLowerCase().includes('fee'));
    if (activeTab === 'academic') return notifs.filter(n => n.type === 'academic' || n.sub_category?.toLowerCase().includes('homework') || n.sub_category?.toLowerCase().includes('syllabus'));
    if (activeTab === 'exams') return notifs.filter(n => n.type === 'result' || n.type === 'exam_datesheet' || n.sub_category?.toLowerCase().includes('exam') || n.sub_category?.toLowerCase().includes('date sheet') || n.sub_category?.toLowerCase().includes('datesheet'));
    if (activeTab === 'holidays') return notifs.filter(n => n.type === 'holiday' || n.sub_category?.toLowerCase().includes('holiday'));
    return notifs;
  }, [notifs, activeTab]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span>📢</span> Notifications & Notices
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {unread > 0
              ? <><span className="text-blue-600 font-bold">{unread}</span> unread announcement{unread > 1 ? 's' : ''}</>
              : 'All caught up ✓ No new unread notices'
            }
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          { id: 'all',      label: 'All Notices' },
          { id: 'academic', label: '📚 Academic' },
          { id: 'fees',     label: '💳 Fees' },
          { id: 'exams',    label: '📅 Exams & Datesheets' },
          { id: 'holidays', label: '🌴 Holidays' },
          { id: 'urgent',   label: '🚨 Urgent' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-xs space-y-2">
          <span className="text-3xl block">📭</span>
          <span>No notifications found in this category.</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifs.map(n => {
            const style = typeStyle[n.type] || typeStyle.general;
            const isUrgent = n.priority === 'urgent';
            const isHigh   = n.priority === 'high';
            const dest     = getNotificationDestination(n, user?.role);

            return (
              <div
                key={n.id}
                onClick={() => {
                  setSelectedNotif(n);
                  if (!n.is_read) markRead(n.id);
                }}
                className={`flex gap-3 sm:gap-4 p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] shadow-xs group
                  ${isUrgent
                    ? 'bg-red-50/50 border-red-200 ring-1 ring-red-100 hover:bg-red-50/80'
                    : n.is_read
                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100 hover:bg-blue-50/80'
                  }`}
              >
                <span className="text-xl sm:text-2xl mt-0.5 flex-shrink-0">{style.icon}</span>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`font-bold text-sm ${n.is_read ? 'text-gray-800' : 'text-gray-900 font-extrabold'}`}>
                      {n.title}
                    </span>

                    {/* Subcategory Pill */}
                    {n.sub_category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                        🏷️ {n.sub_category}
                      </span>
                    )}

                    {/* Priority Badge */}
                    {isUrgent ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold animate-pulse">
                        🚨 Urgent
                      </span>
                    ) : isHigh ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                        ⚠️ High
                      </span>
                    ) : null}

                    {/* Target Specificity (e.g. Class 8th) */}
                    {n.target_class && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                        🎓 {n.target_class} {n.target_section ? `(${n.target_section})` : ''}
                      </span>
                    )}

                    {!n.is_read && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{n.message}</p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-gray-100/80">
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span>From: <strong className="text-gray-600">{n.sender?.name || 'School Administration'}</strong></span>
                      <span>•</span>
                      <span>{formatDate(n.created_at || n.createdAt)}</span>
                    </div>

                    {/* Direct Action Link Button */}
                    {dest?.url && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!n.is_read) markRead(n.id);
                          navigate(dest.url);
                        }}
                        className="self-start sm:self-auto px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                      >
                        <span>{dest.label}</span>
                        <span>➔</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <NotificationDetailModal
        isOpen={!!selectedNotif}
        notification={selectedNotif}
        onClose={() => setSelectedNotif(null)}
        onMarkRead={markRead}
        userRole={user?.role}
      />
    </div>
  );
}
