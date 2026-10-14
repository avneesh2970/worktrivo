import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskTimer } from '../context/TaskTimerContext';
import { Play, Pause, Square, FileText, Clock, X } from 'lucide-react';

const ActiveTaskTimerBar = () => {
  const navigate = useNavigate();
  const { activeTimer, pauseTimer, resumeTimer, stopTimer, resetTimer, formatTime } = useTaskTimer();

  if (!activeTimer) return null;

  const handleLogToDailyReport = () => {
    const summary = stopTimer();
    if (!summary) return;
    navigate(`/daily-reports?taskId=${encodeURIComponent(summary.taskId)}&hours=${encodeURIComponent(summary.hours)}&autoOpen=true`);
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] max-w-xl w-[92vw] sm:w-auto animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/90 dark:bg-[#121826]/95 border border-[#10b981]/40 text-white shadow-2xl backdrop-blur-md">
        {/* Pulsing indicator & Timer */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center">
            <span className={`h-2.5 w-2.5 rounded-full ${activeTimer.isRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span className={`absolute h-2 w-2 rounded-full ${activeTimer.isRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-black text-[#10b981] tracking-wider">
                {formatTime(activeTimer.seconds)}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                {activeTimer.isRunning ? 'Logging Work' : 'Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate max-w-[200px] sm:max-w-xs font-medium">
              {activeTimer.taskTitle}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Pause / Resume */}
          {activeTimer.isRunning ? (
            <button
              onClick={pauseTimer}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Pause Timer"
            >
              <Pause size={14} />
            </button>
          ) : (
            <button
              onClick={resumeTimer}
              className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
              title="Resume Timer"
            >
              <Play size={14} />
            </button>
          )}

          {/* Log to Daily Report Button */}
          <button
            onClick={handleLogToDailyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Stop timer and log hours into today's daily report"
          >
            <FileText size={13} />
            <span className="hidden sm:inline">Log to Report</span>
          </button>

          {/* Reset / Dismiss */}
          <button
            onClick={resetTimer}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
            title="Cancel & Dismiss Timer"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveTaskTimerBar;
