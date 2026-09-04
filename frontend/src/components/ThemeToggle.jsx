import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun, desc: 'Clean & crisp bright theme' },
  { key: 'dark', label: 'Dark', icon: Moon, desc: 'Eye-friendly deep theme' },
  { key: 'system', label: 'System', icon: Laptop, desc: 'Follow device preferences' },
];

export const ThemeToggleDropdown = ({ align = 'right' }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const CurrentIcon = theme === 'system' ? Laptop : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Switch Theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#10b981]/50 active:scale-95 ${
          isOpen
            ? 'border-[#10b981] bg-slate-100 dark:bg-[#1e2640] text-[#10b981] shadow-md shadow-[#10b981]/10'
            : 'border-slate-200 dark:border-[#1e2640] bg-slate-100/80 dark:bg-[#1e2640]/40 text-slate-600 dark:text-slate-300 hover:border-[#10b981]/40 hover:bg-slate-200/80 dark:hover:bg-[#1e2640] hover:text-[#10b981]'
        }`}
      >
        <CurrentIcon size={18} className="transition-transform duration-300 hover:rotate-12" />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } mt-2 w-56 rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white/95 dark:bg-[#0d101c]/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150`}
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Appearance
            </p>
          </div>

          <div className="space-y-1">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    setTheme(opt.key);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[#10b981]/15 text-[#10b981] font-semibold border border-[#10b981]/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e2640]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={isSelected ? 'text-[#10b981]' : 'text-slate-400'} />
                    <div className="text-left">
                      <p className="leading-tight">{opt.label}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-[#10b981] ml-2 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const ThemeToggleCompact = ({ className = '' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-200 transition-colors ${className}`}
    >
      {isDark ? (
        <>
          <Sun size={16} className="text-amber-400 shrink-0" />
          <span>Light Mode</span>
        </>
      ) : (
        <>
          <Moon size={16} className="text-indigo-500 shrink-0" />
          <span>Dark Mode</span>
        </>
      )}
    </button>
  );
};

export default ThemeToggleDropdown;
