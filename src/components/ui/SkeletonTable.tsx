/**
 * Skeleton Table Component
 * Loading placeholder for table-based content
 */

import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  showActions?: boolean;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  showActions = true,
  className = '',
}: SkeletonTableProps) {
  return (
    <div className={`bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.05] rounded-[3rem] overflow-hidden ${className}`}>
      {/* Header Skeleton */}
      {showHeader && (
        <div className="p-6 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-8 bg-slate-200 dark:bg-white/10 rounded-lg w-48 animate-pulse" />
              <div className="h-6 bg-slate-200 dark:bg-white/10 rounded-lg w-24 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-32 animate-pulse" />
              <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-32 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Table Skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/[0.05]">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-6 py-4 text-left">
                  <div 
                    className="h-4 bg-slate-200 dark:bg-white/10 rounded animate-pulse"
                    style={{ width: `${40 + Math.random() * 40}%` }}
                  />
                </th>
              ))}
              {showActions && (
                <th className="px-6 py-4 text-right w-24">
                  <div className="h-4 bg-slate-200 dark:bg-white/10 rounded animate-pulse w-16 ml-auto" />
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="border-b border-slate-100 dark:border-white/[0.05] last:border-0"
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4">
                    <div 
                      className="h-4 bg-slate-200 dark:bg-white/10 rounded animate-pulse"
                      style={{ 
                        width: colIndex === 0 ? '80%' : `${50 + Math.random() * 40}%`,
                        animationDelay: `${rowIndex * 0.1}s`
                      }}
                    />
                  </td>
                ))}
                {showActions && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <div 
                        className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse"
                        style={{ animationDelay: `${rowIndex * 0.1 + 0.05}s` }}
                      />
                      <div 
                        className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse"
                        style={{ animationDelay: `${rowIndex * 0.1 + 0.1}s` }}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Skeleton */}
      <div className="p-6 border-t border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-32 animate-pulse" />
          <div className="flex gap-2">
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton specifically for Siswa Table
 */
export function SkeletonSiswaTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.05] rounded-[3rem] overflow-hidden">
      {/* Toolbar Skeleton */}
      <div className="p-6 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-64 animate-pulse" />
            <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-40 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-32 animate-pulse" />
            <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-32 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/30 dark:bg-white/[0.01]">
              <th className="px-6 py-4 w-12">
                <div className="w-5 h-5 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
              </th>
              <th className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-16 animate-pulse" />
              </th>
              <th className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-24 animate-pulse" />
              </th>
              <th className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-32 animate-pulse" />
              </th>
              <th className="px-6 py-4 text-right">
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-16 ml-auto animate-pulse" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-white/[0.05] last:border-0">
                <td className="px-6 py-5">
                  <div className="w-5 h-5 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse" />
                    <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-24 animate-pulse" />
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-20 animate-pulse" />
                </td>
                <td className="px-6 py-5">
                  <div className="space-y-1">
                    <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-32 animate-pulse" />
                    <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-16 animate-pulse" />
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
                    <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-6 border-t border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-48 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            <div className="w-10 h-10 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkeletonTable;
