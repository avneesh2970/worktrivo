import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const priorityColor = {
  Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  High: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
  Urgent: 'bg-red-200 text-red-800 dark:bg-red-950/70 dark:text-red-300',
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Props:
 *  - tasks: array of task objects (already filtered/searched by the parent)
 *  - navigate: react-router navigate fn
 */
const CalendarView = ({ tasks, navigate }) => {
  const [cursor, setCursor] = useState(new Date());
  const [dayModal, setDayModal] = useState(null);

  const today = new Date();

  const tasksByDay = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return map;
  }, [tasks]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(year, month, day) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null });
    }
    return cells;
  }, [cursor]);

  const getTasksFor = (date) => {
    if (!date) return [];
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return tasksByDay.get(key) || [];
  };

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-2.5 py-1 text-xs font-medium rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map((cell, idx) => {
          const dayTasks = getTasksFor(cell.date);
          const isToday = cell.date && sameDay(cell.date, today);
          const visibleTasks = dayTasks.slice(0, 3);
          const overflow = dayTasks.length - visibleTasks.length;

          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r border-slate-100 dark:border-slate-800/70 p-1.5 ${
                !cell.date ? 'bg-slate-50/40 dark:bg-slate-900/40' : ''
              }`}
            >
              {cell.date && (
                <>
                  <div className="flex justify-end mb-1">
                    <span
                      className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {visibleTasks.map((t) => (
                      <button
                        key={t._id}
                        onClick={() => navigate(`/tasks/${t._id}`)}
                        title={t.title}
                        className={`block w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          priorityColor[t.priority] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <button
                        onClick={() => setDayModal(cell.date)}
                        className="block w-full text-left px-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {dayModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                {dayModal.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </h4>
              <button onClick={() => setDayModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {getTasksFor(dayModal).map((t) => (
                <button
                  key={t._id}
                  onClick={() => {
                    setDayModal(null);
                    navigate(`/tasks/${t._id}`);
                  }}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColor[t.priority] || ''}`}>
                      {t.priority}
                    </span>
                    <span className="text-[10px] text-slate-400">{t.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;