'use client';

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-2xl bg-white/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 flex items-center justify-center animate-pulse">
        <span className="w-5 h-5 bg-slate-300 dark:bg-slate-700 rounded-full" />
      </div>
    );
  }

  const isDarkMode = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
      className="relative w-10 h-10 rounded-2xl bg-white/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all outline-none shadow-sm dark:shadow-none overflow-hidden group"
      aria-label="Toggle Theme"
    >
      <div className={`absolute transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDarkMode ? 'translate-y-10 opacity-0 rotate-90 scale-50' : 'translate-y-0 opacity-100 rotate-0 scale-100'}`}>
        <Sun className="w-[18px] h-[18px] text-amber-500 group-hover:text-amber-600 transition-colors" />
      </div>
      <div className={`absolute transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDarkMode ? 'translate-y-0 opacity-100 rotate-0 scale-100' : '-translate-y-10 opacity-0 -rotate-90 scale-50'}`}>
        <Moon className="w-[18px] h-[18px] text-indigo-400 group-hover:text-indigo-300 transition-colors" />
      </div>
    </button>
  );
}
