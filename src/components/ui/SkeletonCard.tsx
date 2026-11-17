/**
 * Skeleton Card Component
 * Loading placeholder for card-based content
 */

import React from 'react';

interface SkeletonCardProps {
  className?: string;
  rows?: number;
  showAvatar?: boolean;
  showActions?: boolean;
}

export function SkeletonCard({ 
  className = '', 
  rows = 3, 
  showAvatar = true,
  showActions = true 
}: SkeletonCardProps) {
  return (
    <div className={`bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.05] rounded-[2rem] p-6 animate-pulse ${className}`}>
      <div className="flex items-start gap-4">
        {showAvatar && (
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-white/10 flex-shrink-0" />
        )}
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-lg w-3/4" />
          {Array.from({ length: rows }).map((_, i) => (
            <div 
              key={i} 
              className="h-3 bg-slate-200 dark:bg-white/10 rounded-lg"
              style={{ width: `${60 + Math.random() * 30}%` }}
            />
          ))}
        </div>
      </div>
      {showActions && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex gap-2">
          <div className="h-8 bg-slate-200 dark:bg-white/10 rounded-xl w-20" />
          <div className="h-8 bg-slate-200 dark:bg-white/10 rounded-xl w-20" />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton for Siswa Card specifically
 */
export function SkeletonSiswaCard() {
  return (
    <div className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.05] rounded-[2.5rem] p-8 animate-pulse">
      <div className="flex items-center gap-5">
        {/* Avatar Skeleton */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-white/10" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 border-2 border-white dark:border-[#0a0e1a]" />
        </div>
        
        {/* Info Skeleton */}
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-200 dark:bg-white/10 rounded-lg w-1/2" />
          <div className="flex items-center gap-2">
            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-20" />
            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-px" />
            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-24" />
          </div>
        </div>
        
        {/* Actions Skeleton */}
        <div className="flex gap-2">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Grid for multiple cards
 */
interface SkeletonGridProps {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
}

export function SkeletonSiswaGrid({ count = 6, columns = 1 }: SkeletonGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonSiswaCard key={i} />
      ))}
    </div>
  );
}

export default SkeletonCard;
