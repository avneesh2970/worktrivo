import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_WIDTH = 34;
const ROW_HEIGHT = 40;

const statusBarColor = {
  'To Do': 'bg-slate-400',
  'In Progress': 'bg-blue-500',
  'In Review': 'bg-violet-500',
  'Blocked': 'bg-orange-500',
  'Completed (Pending Approval)': 'bg-amber-500',
  'Approved': 'bg-emerald-500',
  'Rejected': 'bg-rose-500',
  'Overdue': 'bg-red-600',
};

const startOfDay = (d) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};
const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / (24 * 60 * 60 * 1000));

/**
 * Props:
 *  - tasks: array of task objects (already filtered/searched by the parent)
 *  - navigate: react-router navigate fn
 */
const GanttChart = ({ tasks, navigate }) => {
  const [windowStart, setWindowStart] = useState(() => addDays(startOfDay(new Date()), -7));
  const visibleDays = 45;

  const rows = useMemo(() => {
    return tasks
      .filter((t) => t.dueDate)
      .map((t) => {
        const due = startOfDay(t.dueDate);
        const start = t.startDate ? startOfDay(t.startDate) : addDays(due, -1);
        const end = due < start ? start : due;
        return { task: t, start, end };
      })
      .sort((a, b) => a.start - b.start);
  }, [tasks]);

  const today = startOfDay(new Date());
  const windowEnd = addDays(windowStart, visibleDays);

  const dayHeaders = useMemo(() => {
    const arr = [];
    for (let i = 0; i < visibleDays; i++) arr.push(addDays(windowStart, i));
    return arr;
  }, [windowStart]);

  const totalWidth = visibleDays * DAY_WIDTH;
  const todayOffset = dayDiff(windowStart, today) * DAY_WIDTH;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Timeline — {windowStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to{' '}
          {addDays(windowEnd, -1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWindowStart((w) => addDays(w, -14))}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            title="Back 2 weeks"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWindowStart(addDays(startOfDay(new Date()), -7))}
            className="px-2.5 py-1 text-xs font-medium rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            Today
          </button>
          <button
            onClick={() => setWindowStart((w) => addDays(w, 14))}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            title="Forward 2 weeks"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-10">No tasks with due dates to plot.</p>
      ) : (
        <div className="flex">
          <div className="flex-shrink-0 w-48 border-r border-slate-200 dark:border-slate-800">
            <div style={{ height: 34 }} className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40" />
            {rows.map(({ task }) => (
              <div
                key={task._id}
                style={{ height: ROW_HEIGHT }}
                onClick={() => navigate(`/tasks/${task._id}`)}
                className="flex items-center px-3 border-b border-slate-100 dark:border-slate-800/70 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{task.title}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, position: 'relative' }}>
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40" style={{ height: 34 }}>
                {dayHeaders.map((d, i) => (
                  <div
                    key={i}
                    style={{ width: DAY_WIDTH }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800/50 ${
                      sameDayCheck(d, today) ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    <span className="text-[9px] text-slate-400 leading-none">
                      {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </span>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-none mt-0.5">
                      {d.getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                  style={{ left: todayOffset, top: 34, bottom: 0 }}
                  className="absolute w-px bg-indigo-500 z-10"
                />
              )}

              {rows.map(({ task, start, end }) => {
                const offsetDays = dayDiff(windowStart, start);
                const lengthDays = Math.max(1, dayDiff(start, end) + 1);
                const left = offsetDays * DAY_WIDTH;
                const width = lengthDays * DAY_WIDTH;
                const color = statusBarColor[task.status] || 'bg-slate-400';

                if (left + width < 0 || left > totalWidth) {
                  return (
                    <div key={task._id} style={{ height: ROW_HEIGHT }} className="border-b border-slate-100 dark:border-slate-800/70" />
                  );
                }

                return (
                  <div
                    key={task._id}
                    style={{ height: ROW_HEIGHT }}
                    className="relative border-b border-slate-100 dark:border-slate-800/70"
                  >
                    <div
                      onClick={() => navigate(`/tasks/${task._id}`)}
                      title={`${task.title} — ${task.status} (${start.toLocaleDateString()} → ${end.toLocaleDateString()})`}
                      style={{
                        left: Math.max(left, 0),
                        width: Math.max(width - (left < 0 ? -left : 0), 8),
                        top: 8,
                        height: ROW_HEIGHT - 16,
                      }}
                      className={`absolute rounded-md ${color} opacity-90 hover:opacity-100 cursor-pointer shadow-sm flex items-center px-2`}
                    >
                      <span className="text-[10px] font-medium text-white truncate">{task.priority}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function sameDayCheck(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default GanttChart;