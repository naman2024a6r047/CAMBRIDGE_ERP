import { useState, useEffect, useMemo } from 'react';
import API from '../../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/helpers';

export default function MultiMonthFeeForm({ student, year, onSubmit, loading }) {
  const baseYear = useMemo(() => parseInt(year) || new Date().getFullYear(), [year]);
  const [activeYear, setActiveYear]         = useState(baseYear);
  const [selectedSlots, setSelectedSlots]   = useState([]);
  const [mode, setMode]                     = useState('cash');
  const [remarks, setRemarks]               = useState('');
  const [feeAmount, setFeeAmount]           = useState(0);
  const [studentFees, setStudentFees]       = useState([]);
  const [fetchingFees, setFetchingFees]     = useState(true);

  useEffect(() => {
    setActiveYear(baseYear);
    setSelectedSlots([]);
  }, [student?.id, baseYear]);

  useEffect(() => {
    // Fetch fee structure for student's class (synced with admin-configured class fee)
    const qs = student?.session_id ? `?session_id=${student.session_id}` : '';
    API.get(`/fees/structure/${encodeURIComponent(student.class || '')}${qs}`)
      .then(r => setFeeAmount(parseFloat(r.data?.monthly_fee || 0)))
      .catch(() => setFeeAmount(0));

    // Fetch existing fees to determine paid/unpaid status across academic cycle
    setFetchingFees(true);
    API.get(`/fees/student/${student.id}`)
      .then(r => {
        // Keep all monthly and admission fees so cross-year status is fully tracked
        const monthlyRecords = (r.data || []).filter(
          f => f.fee_type === 'monthly' || f.fee_type === 'admission'
        );
        setStudentFees(monthlyRecords);
      })
      .catch(() => toast.error('Failed to load student fee records.'))
      .finally(() => setFetchingFees(false));
  }, [student?.id, student?.class, student?.session_id]);

  const MONTHS_LIST = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const toSlotIndex = (m, y) => parseInt(y) * 12 + MONTHS_LIST.indexOf(m);
  const fromSlotIndex = (idx) => ({
    month: MONTHS_LIST[((idx % 12) + 12) % 12],
    year: Math.floor(idx / 12)
  });

  // Calculate paid slots and sequential starting index
  const { paidSlotIndices, startPayableIndex } = useMemo(() => {
    const paidSet = new Set(
      studentFees
        .filter(f => f.fee_type === 'monthly' && f.status === 'paid')
        .map(f => toSlotIndex(f.month, f.year))
    );

    let maxPaid = -1;
    paidSet.forEach(idx => {
      if (idx > maxPaid) maxPaid = idx;
    });

    let startPayable;
    if (maxPaid !== -1) {
      startPayable = maxPaid + 1;
    } else {
      const unpaidRecords = studentFees
        .filter(f => f.fee_type === 'monthly' && f.status !== 'paid')
        .map(f => toSlotIndex(f.month, f.year));
      startPayable = unpaidRecords.length > 0
        ? Math.min(...unpaidRecords)
        : toSlotIndex('January', baseYear);
    }

    return { paidSlotIndices: paidSet, startPayableIndex: startPayable };
  }, [studentFees, baseYear]);

  // Determine status of a month in a given year
  const getSlotStatus = (m, y) => {
    const idx = toSlotIndex(m, y);

    if (paidSlotIndices.has(idx)) {
      return 'paid';
    }

    if (idx < startPayableIndex) {
      return 'locked';
    }

    if (idx === startPayableIndex) {
      return 'unpaid';
    }

    // For any subsequent month: unlocked if previous month is paid OR currently selected
    const prevPaid = paidSlotIndices.has(idx - 1);
    const prevSelected = selectedSlots.some(s => toSlotIndex(s.month, s.year) === (idx - 1));

    if (prevPaid || prevSelected) {
      return 'unpaid';
    }

    return 'locked';
  };

  const isSlotSelected = (m, y) => {
    const targetIdx = toSlotIndex(m, y);
    return selectedSlots.some(s => toSlotIndex(s.month, s.year) === targetIdx);
  };

  const toggleSlot = (m, y) => {
    const status = getSlotStatus(m, y);
    if (status === 'paid' || status === 'locked') return;

    const targetIdx = toSlotIndex(m, y);
    const alreadySelected = isSlotSelected(m, y);

    if (alreadySelected) {
      // Deselecting: also remove all slots that come after it
      setSelectedSlots(prev => prev.filter(s => toSlotIndex(s.month, s.year) < targetIdx));
    } else {
      // Selecting: add slot and maintain chronological order
      const next = [...selectedSlots, { month: m, year: parseInt(y) }];
      next.sort((a, b) => toSlotIndex(a.month, a.year) - toSlotIndex(b.month, b.year));
      setSelectedSlots(next);
    }
  };

  const handleQuickSelect = (count) => {
    const slots = [];
    let currIdx = startPayableIndex;
    while (slots.length < count) {
      if (!paidSlotIndices.has(currIdx)) {
        slots.push(fromSlotIndex(currIdx));
      }
      currIdx++;
      if (currIdx > startPayableIndex + 24) break;
    }
    setSelectedSlots(slots);
  };

  const handleSubmit = () => {
    if (!selectedSlots.length) return toast.error('Select at least one month.');
    onSubmit({
      months: selectedSlots.map(s => ({
        month:  s.month,
        year:   s.year,
        amount: feeAmount
      })),
      payment_mode: mode,
      remarks,
    });
  };

  const countForYear = (y) => selectedSlots.filter(s => parseInt(s.year) === parseInt(y)).length;
  const countBaseYear = countForYear(baseYear);
  const countNextYear = countForYear(baseYear + 1);

  const decOfBaseYearSelected = isSlotSelected('December', baseYear);

  const f = 'border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 bg-white w-full';

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex justify-between items-center">
        <span>Monthly fee for {student.class}: <strong>{formatCurrency(feeAmount)}</strong></span>
        {selectedSlots.length > 0 && (
          <span className="font-semibold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-lg">
            {selectedSlots.length} month{selectedSlots.length > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {fetchingFees ? (
        <p className="text-center text-gray-400 text-xs py-4">Checking fee records...</p>
      ) : (
        <>
          {/* Year Switcher & Quick Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => setActiveYear(baseYear)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeYear === baseYear
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{baseYear}</span>
                {countBaseYear > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {countBaseYear}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveYear(baseYear + 1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeYear === baseYear + 1
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{baseYear + 1} (Next Year)</span>
                {countNextYear > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {countNextYear}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleQuickSelect(3)}
                className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                title="Select next 3 sequential months"
              >
                +3 Months
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(6)}
                className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                title="Select next 6 sequential months"
              >
                +6 Months
              </button>
              {selectedSlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSlots([])}
                  className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Month Selection Grid for Active Year */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">
                Months for <strong>{activeYear}</strong> (Sequential Order Required):
              </label>
              {activeYear === baseYear && (
                <span className="text-[11px] text-gray-400">
                  Select through Dec to unlock {baseYear + 1}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {MONTHS_LIST.map(m => {
                const status = getSlotStatus(m, activeYear);
                const selected = isSlotSelected(m, activeYear);
                let btnStyle = '';

                if (status === 'paid') {
                  btnStyle = 'bg-green-100 text-green-700 border-green-200 cursor-not-allowed opacity-75';
                } else if (status === 'locked') {
                  btnStyle = 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50';
                } else if (selected) {
                  btnStyle = 'bg-blue-600 text-white border-blue-600 shadow-sm';
                } else {
                  btnStyle = 'border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 cursor-pointer bg-white';
                }

                return (
                  <button
                    key={`${m}-${activeYear}`}
                    type="button"
                    onClick={() => toggleSlot(m, activeYear)}
                    disabled={status === 'paid' || status === 'locked'}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all flex flex-col items-center justify-center gap-0.5 ${btnStyle}`}
                  >
                    <span>{m.slice(0, 3)}</span>
                    {status === 'paid' && (
                      <span className="text-[9px] uppercase font-bold tracking-wider text-green-800">Paid</span>
                    )}
                    {status === 'locked' && (
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                    {selected && (
                      <span className="text-[9px] uppercase font-bold tracking-wider text-blue-100">Selected</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Cross-Year Prompt when December is selected on baseYear */}
            {activeYear === baseYear && decOfBaseYearSelected && (
              <button
                type="button"
                onClick={() => setActiveYear(baseYear + 1)}
                className="w-full mt-2.5 py-2 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 rounded-xl text-xs font-medium text-blue-700 flex items-center justify-between transition-colors shadow-sm"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base">📅</span>
                  <span>December {baseYear} selected! Click here to select <strong>{baseYear + 1}</strong> months.</span>
                </span>
                <span className="font-semibold underline">Next Year &rarr;</span>
              </button>
            )}
          </div>

          {/* Selected Months Summary */}
          {selectedSlots.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm border border-gray-200 space-y-2">
              <div className="flex justify-between font-semibold text-gray-800">
                <span>Total Due ({selectedSlots.length} month{selectedSlots.length > 1 ? 's' : ''})</span>
                <span className="text-blue-600 text-lg font-bold">{formatCurrency(selectedSlots.length * feeAmount)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSlots.map(s => (
                  <span
                    key={`${s.month}-${s.year}`}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-semibold"
                  >
                    {s.month.slice(0, 3)} {s.year}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className={f}>
              <option value="cash">Cash</option>
              <option value="online">Online / UPI</option>
              <option value="cheque">Cheque</option>
              <option value="dd">Demand Draft</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Remarks (Optional)</label>
            <input
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className={f}
              placeholder="Enter transaction ID or remarks"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || selectedSlots.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2 shadow-sm"
          >
            {loading ? 'Processing...' : `Collect ${formatCurrency(selectedSlots.length * feeAmount)}`}
          </button>
        </>
      )}
    </div>
  );
}
