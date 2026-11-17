import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNotificationDestination } from '../../utils/notificationNavigation';
import { formatDate } from '../../utils/helpers';
import API from '../../utils/api';

const NOTIF_ICONS = {
  exam_datesheet:   '📅',
  result:           '📊',
  fee_reminder:     '💳',
  attendance_alert: '⏰',
  holiday:          '🌴',
  academic:         '📚',
  achievement:      '🏆',
  emergency:        '🚨',
  general:          '📢',
};

export default function NotificationDetailModal({
  isOpen,
  onClose,
  notification,
  userRole,
  onMarkRead,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!isOpen || !notification) return null;

  const currentRole = userRole || user?.role || '';
  const destination = getNotificationDestination(notification, currentRole);
  const icon = NOTIF_ICONS[notification.type] || '📢';
  const isUrgent = notification.priority === 'urgent';
  const isHigh = notification.priority === 'high';

  const markAsRead = async () => {
    if (notification.id && !notification.is_read) {
      try {
        await API.post(`/notifications/${notification.id}/read`);
        if (onMarkRead) onMarkRead(notification.id);
      } catch (err) {
        // Non-blocking
      }
    }
  };

  const handleActionClick = async () => {
    await markAsRead();
    if (onClose) onClose();
    if (destination?.url) {
      navigate(destination.url);
    }
  };

  const handleClose = async () => {
    await markAsRead();
    if (onClose) onClose();
  };

  // Format Audience Label
  let audienceLabel = '🌐 Everyone';
  let audienceBg = 'bg-gray-100 text-gray-700';

  if (notification.recipient_type === 'individual') {
    audienceLabel = '👤 Individual Notice';
    audienceBg = 'bg-purple-100 text-purple-700';
  } else if (notification.recipient_role === 'teachers' || notification.recipient_role === 'teacher') {
    audienceLabel = notification.target_subject
      ? `👨‍🏫 Teaching Staff (${notification.target_subject})`
      : '👨‍🏫 All Teachers';
    audienceBg = 'bg-indigo-100 text-indigo-700 font-semibold';
  } else if (['students', 'student', 'parents', 'parent'].includes(notification.recipient_role)) {
    const classPart = notification.target_class ? notification.target_class : 'All Classes';
    const secPart = notification.target_section ? `-${notification.target_section}` : '';
    audienceLabel = `🎓 Students (${classPart}${secPart})`;
    audienceBg = 'bg-emerald-100 text-emerald-800 font-semibold';
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          className={`p-6 border-b flex items-start justify-between gap-4 ${
            isUrgent
              ? 'bg-rose-50/70 border-rose-100'
              : isHigh
              ? 'bg-amber-50/70 border-amber-100'
              : 'bg-slate-50 border-slate-100'
          }`}
        >
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-xs ${
                isUrgent
                  ? 'bg-rose-100 text-rose-600'
                  : isHigh
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Priority Badge */}
                {isUrgent ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold uppercase tracking-wider animate-pulse">
                    🚨 Urgent Alert
                  </span>
                ) : isHigh ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold uppercase tracking-wider">
                    ⚠️ High Priority
                  </span>
                ) : null}

                {/* Subcategory */}
                {notification.sub_category && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                    🏷️ {notification.sub_category}
                  </span>
                )}

                {/* Audience Scope */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${audienceBg}`}>
                  {audienceLabel}
                </span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900 leading-snug break-words">
                {notification.title}
              </h3>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notice Details</h4>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
              {notification.message}
            </p>
          </div>

          {/* Context & Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-white rounded-2xl p-3 border border-slate-100">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Sender</span>
              <span className="font-semibold text-slate-800">
                {notification.sender?.name || 'School Administration'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Dispatched At</span>
              <span className="font-semibold text-slate-800">
                {formatDate(notification.created_at || notification.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer with Action CTA */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
          >
            Dismiss
          </button>

          {destination?.url && (
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 group"
            >
              <span>{destination.label}</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
