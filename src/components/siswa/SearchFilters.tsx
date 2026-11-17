/**
 * Advanced Search Filters Component
 * Multi-criteria filtering interface for siswa management
 */

import { Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { SearchFilters } from '@/hooks/useAdvancedSearch';

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  kelas: any[];
  filterStats: { total: number; byJenjang: { SMP: number; SMA: number } };
  isSearching: boolean;
  suggestions: string[];
}

export default function SearchFiltersPanel({ 
  filters, 
  onFiltersChange, 
  kelas, 
  filterStats, 
  isSearching,
  suggestions 
}: SearchFiltersProps) {
  
  const handleClearFilters = () => {
    onFiltersChange({
      searchTerm: '',
      id_kelas: 'ALL',
      jenjang: 'ALL',
      sortBy: 'nama',
      sortOrder: 'asc'
    });
  };

  const hasActiveFilters = filters.searchTerm || filters.id_kelas !== 'ALL' || filters.jenjang !== 'ALL';

  return (
    <div className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.03] rounded-3xl p-6 space-y-6 shadow-sm">
      {/* Search Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <SlidersHorizontal className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
              Filter & Pencarian Lanjutan
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {filterStats.total} siswa ditemukan • {filterStats.byJenjang.SMP} SMP • {filterStats.byJenjang.SMA} SMA
            </p>
          </div>
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest transition-colors"
          >
            <X className="w-4 h-4" />
            Reset Filter
          </button>
        )}
      </div>

      {/* Search Input with Suggestions */}
      <div className="relative">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            id="search-input"
            type="text"
            placeholder="Cari NIS atau Nama Siswa..."
            value={filters.searchTerm}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
            className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl pl-12 pr-4 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        {/* Search Suggestions */}
        {suggestions.length > 0 && filters.searchTerm && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onFiltersChange({ ...filters, searchTerm: suggestion })}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/[0.03] last:border-0"
              >
                <span className="font-medium">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kelas Filter */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
            Filter Kelas
          </label>
          <select
            value={filters.id_kelas}
            onChange={(e) => onFiltersChange({ ...filters, id_kelas: e.target.value })}
            className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
          >
            <option value="ALL">Semua Kelas</option>
            {kelas.map(k => (
              <option key={k.id_kelas} value={k.id_kelas}>
                [{k.jenjang}] {k.nama_kelas}
              </option>
            ))}
          </select>
        </div>

        {/* Jenjang Filter */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
            Filter Jenjang
          </label>
          <select
            value={filters.jenjang}
            onChange={(e) => onFiltersChange({ ...filters, jenjang: e.target.value })}
            className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
          >
            <option value="ALL">Semua Jenjang</option>
            <option value="SMP">SMP</option>
            <option value="SMA">SMA</option>
          </select>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
            Urutkan Berdasarkan
          </label>
          <div className="flex gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as any })}
              className="flex-1 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
            >
              <option value="nama">Nama</option>
              <option value="nis">NIS</option>
              <option value="kelas">Kelas</option>
            </select>
            <button
              onClick={() => onFiltersChange({ 
                ...filters, 
                sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
              })}
              className="px-4 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-colors"
              title={filters.sortOrder === 'asc' ? 'Urutkan Descending' : 'Urutkan Ascending'}
            >
              <ArrowUpDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
