import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CLASSES, SECTIONS, SUBJECTS } from '../../constants/roles';

export default function NotificationForm({ onSubmit, loading = false }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      recipient_role: 'all',
      type: 'general',
      target_class: 'all',
      target_section: 'all',
      target_subject: 'all',
      priority: 'normal',
      sub_category: 'Circular',
    }
  });

  const selectedAudience = watch('recipient_role');

  const submit = async (data) => {
    const payload = {
      title: data.title?.trim(),
      message: data.message?.trim(),
      type: data.type || 'general',
      recipient_type: data.recipient_role === 'all' ? 'all' : 'role',
      recipient_role: data.recipient_role === 'all' ? 'all' : data.recipient_role,
      target_class: data.recipient_role === 'students' && data.target_class !== 'all' ? data.target_class : undefined,
      target_section: data.recipient_role === 'students' && data.target_section !== 'all' ? data.target_section : undefined,
      target_subject: data.recipient_role === 'teachers' && data.target_subject !== 'all' ? data.target_subject : undefined,
      sub_category: data.sub_category || 'General',
      priority: data.priority || 'normal',
    };
    await onSubmit(payload);
    reset();
  };

  const f = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white';
  const e = 'text-red-500 text-xs mt-0.5';
  const l = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label className={l}>Title *</label>
        <input {...register('title', { required: 'Required' })} className={f} placeholder="e.g. Schedule for 1st Term Date Sheet" />
        {errors.title && <p className={e}>{errors.title.message}</p>}
      </div>

      <div>
        <label className={l}>Message *</label>
        <textarea {...register('message', { required: 'Required' })} rows={4}
          className={f} placeholder="Write your announcement details here..." />
        {errors.message && <p className={e}>{errors.message.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Target Audience</label>
          <select {...register('recipient_role')} className={f}>
            <option value="all">🌐 Everyone (All)</option>
            <option value="teachers">👨‍🏫 Teachers Only</option>
            <option value="students">🎓 Students Only</option>
          </select>
        </div>
        <div>
          <label className={l}>Notice Category</label>
          <select {...register('type')} className={f}>
            <option value="general">ℹ️ General Notice</option>
            <option value="academic">📚 Academic & Homework</option>
            <option value="fee_reminder">💳 Fee Reminder</option>
            <option value="exam_datesheet">📝 Exam & Datesheet</option>
            <option value="result">📊 Result & Marksheets</option>
            <option value="attendance_alert">⏰ Attendance Alert</option>
            <option value="holiday">🌴 Holiday</option>
            <option value="achievement">🏆 Event & Sports</option>
            <option value="emergency">🚨 Urgent Alert</option>
          </select>
        </div>
      </div>

      {/* Teacher Department Subcategory */}
      {selectedAudience === 'teachers' && (
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1">
          <label className="block text-xs font-bold text-indigo-900">Department / Subject Subcategory</label>
          <select {...register('target_subject')} className={f}>
            <option value="all">All Teachers</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Class Incharges Only">Class Incharges Only</option>
          </select>
        </div>
      )}

      {/* Student Class & Section Subcategory */}
      {selectedAudience === 'students' && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
          <label className="block text-xs font-bold text-emerald-900">Class & Section Subcategory</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Class</label>
              <select {...register('target_class')} className={f}>
                <option value="all">All Classes (Nursery - 8th)</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Section</label>
              <select {...register('target_section')} className={f}>
                <option value="all">All Sections</option>
                {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Subcategory Tag</label>
          <input {...register('sub_category')} className={f} placeholder="e.g. PTM, Homework, Fee Notice" />
        </div>
        <div>
          <label className={l}>Priority Level</label>
          <select {...register('priority')} className={f}>
            <option value="normal">⚪ Normal</option>
            <option value="high">🟡 High Priority</option>
            <option value="urgent">🔴 Urgent / Critical</option>
          </select>
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-xs">
        {loading ? 'Dispatching Notice...' : '🚀 Dispatch Custom Notification'}
      </button>
    </form>
  );
}
