'use client';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: ReactNode;
  iconBgClass?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Header halaman dashboard terstandarisasi untuk Web & Mobile.
 * Memastikan keseragaman ukuran judul, kontainer ikon vektor, deskripsi, dan toolbar aksi.
 */
export function PageHeader({
  icon,
  iconBgClass = 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/15 dark:border-indigo-500/25 text-indigo-600 dark:text-indigo-400',
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-6 print:hidden w-full min-w-0">
      <div className="min-w-0 w-full lg:w-auto">
        <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4 min-w-0 max-w-full">
          <span
            className={`p-2.5 sm:p-3 rounded-2xl sm:rounded-[1.35rem] shadow-inner border shrink-0 flex items-center justify-center ${iconBgClass}`}
          >
            {icon}
          </span>
          <span className="truncate min-w-0">{title}</span>
        </h1>
        {description && (
          <p className="text-slate-600 dark:text-slate-400 mt-1.5 sm:mt-2.5 font-semibold text-xs sm:text-sm max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
