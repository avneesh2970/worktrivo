import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const TaskTimerContext = createContext();

export const TaskTimerProvider = ({ children }) => {
  const [activeTimer, setActiveTimer] = useState(() => {
    try {
      const saved = localStorage.getItem('task_sphere_active_timer');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If it was running when closed, adjust elapsed seconds based on timestamp
        if (parsed.isRunning && parsed.lastTickAt) {
          const diff = Math.floor((Date.now() - parsed.lastTickAt) / 1000);
          parsed.seconds = (parsed.seconds || 0) + Math.max(0, diff);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved timer', e);
    }
    return null;
  });

  // Ticking effect
  useEffect(() => {
    if (!activeTimer || !activeTimer.isRunning) return;

    const interval = setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev || !prev.isRunning) return prev;
        const updated = {
          ...prev,
          seconds: (prev.seconds || 0) + 1,
          lastTickAt: Date.now()
        };
        try {
          localStorage.setItem('task_sphere_active_timer', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.isRunning]);

  const startTimer = (task) => {
    if (!task || !task._id) return;

    // If starting same task and it's paused, just resume
    if (activeTimer && activeTimer.taskId === task._id) {
      const resumed = { ...activeTimer, isRunning: true, lastTickAt: Date.now() };
      setActiveTimer(resumed);
      localStorage.setItem('task_sphere_active_timer', JSON.stringify(resumed));
      toast.success(`Resumed timer for "${task.title}"`);
      return;
    }

    const newTimer = {
      taskId: task._id,
      taskTitle: task.title,
      seconds: 0,
      isRunning: true,
      startedAt: Date.now(),
      lastTickAt: Date.now()
    };
    setActiveTimer(newTimer);
    localStorage.setItem('task_sphere_active_timer', JSON.stringify(newTimer));
    toast.success(`Started work timer for "${task.title}"`);
  };

  const pauseTimer = () => {
    if (!activeTimer) return;
    const paused = { ...activeTimer, isRunning: false, lastTickAt: Date.now() };
    setActiveTimer(paused);
    localStorage.setItem('task_sphere_active_timer', JSON.stringify(paused));
    toast('Timer paused');
  };

  const resumeTimer = () => {
    if (!activeTimer) return;
    const resumed = { ...activeTimer, isRunning: true, lastTickAt: Date.now() };
    setActiveTimer(resumed);
    localStorage.setItem('task_sphere_active_timer', JSON.stringify(resumed));
    toast.success('Timer resumed');
  };

  const stopTimer = () => {
    if (!activeTimer) return null;
    const finalSeconds = activeTimer.seconds || 0;
    const computedHours = Math.max(0.5, Number((finalSeconds / 3600).toFixed(1)));
    const result = {
      taskId: activeTimer.taskId,
      taskTitle: activeTimer.taskTitle,
      seconds: finalSeconds,
      hours: computedHours
    };
    setActiveTimer(null);
    localStorage.removeItem('task_sphere_active_timer');
    return result;
  };

  const resetTimer = () => {
    setActiveTimer(null);
    localStorage.removeItem('task_sphere_active_timer');
    toast('Timer cleared');
  };

  const formatTime = (totalSeconds) => {
    const s = totalSeconds || 0;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${hrs > 0 ? `${pad(hrs)}:` : ''}${pad(mins)}:${pad(secs)}`;
  };

  return (
    <TaskTimerContext.Provider
      value={{
        activeTimer,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        resetTimer,
        formatTime
      }}
    >
      {children}
    </TaskTimerContext.Provider>
  );
};

export const useTaskTimer = () => {
  const context = useContext(TaskTimerContext);
  if (!context) {
    throw new Error('useTaskTimer must be used within a TaskTimerProvider');
  }
  return context;
};
