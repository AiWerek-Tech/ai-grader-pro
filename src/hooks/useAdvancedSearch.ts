/**
 * Advanced Search & Filtering Hook
 * Multi-criteria search with debouncing and performance optimization
 */

import { useState, useMemo, useEffect } from 'react';

export interface SearchFilters {
  searchTerm: string;
  id_kelas: string;
  jenjang: string;
  sortBy: 'nama' | 'nis' | 'kelas' | 'created';
  sortOrder: 'asc' | 'desc';
}

export interface UseAdvancedSearchOptions {
  debounceMs?: number;
  minSearchLength?: number;
}

export const useAdvancedSearch = (
  siswa: any[], 
  kelas: any[], 
  filters: SearchFilters,
  options: UseAdvancedSearchOptions = {}
) => {
  const { debounceMs = 300, minSearchLength = 2 } = options;
  
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(filters.searchTerm);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search term
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(filters.searchTerm);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [filters.searchTerm, debounceMs]);

  // Advanced filtering with multiple criteria
  const filteredSiswa = useMemo(() => {
    let result = [...siswa];

    // Search term filter (NIS or Nama)
    if (debouncedSearchTerm && debouncedSearchTerm.length >= minSearchLength) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(s => 
        s.nis?.toLowerCase().includes(searchLower) ||
        s.nama?.toLowerCase().includes(searchLower)
      );
    }

    // Kelas filter
    if (filters.id_kelas && filters.id_kelas !== 'ALL') {
      result = result.filter(s => s.id_kelas === filters.id_kelas);
    }

    // Jenjang filter
    if (filters.jenjang && filters.jenjang !== 'ALL') {
      result = result.filter(s => {
        const kelasData = kelas.find(k => k.id_kelas === s.id_kelas);
        return kelasData?.jenjang === filters.jenjang;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let aValue, bValue;
      
      switch (filters.sortBy) {
        case 'nis':
          aValue = a.nis || '';
          bValue = b.nis || '';
          break;
        case 'kelas':
          const kelasA = kelas.find(k => k.id_kelas === a.id_kelas)?.nama_kelas || '';
          const kelasB = kelas.find(k => k.id_kelas === b.id_kelas)?.nama_kelas || '';
          aValue = kelasA;
          bValue = kelasB;
          break;
        case 'created':
          aValue = a.created_at || '';
          bValue = b.created_at || '';
          break;
        case 'nama':
        default:
          aValue = a.nama || '';
          bValue = b.nama || '';
      }

      if (filters.sortOrder === 'desc') {
        return bValue.localeCompare(aValue);
      }
      return aValue.localeCompare(bValue);
    });

    return result;
  }, [siswa, kelas, debouncedSearchTerm, filters.id_kelas, filters.jenjang, filters.sortBy, filters.sortOrder, minSearchLength]);

  // Search suggestions for autocomplete
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < minSearchLength) return [];
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    const suggestions = new Set<string>();
    
    siswa.forEach(s => {
      if (s.nama?.toLowerCase().includes(searchLower)) {
        suggestions.add(s.nama);
      }
      if (s.nis?.toLowerCase().includes(searchLower)) {
        suggestions.add(s.nis);
      }
    });
    
    return Array.from(suggestions).slice(0, 5);
  }, [siswa, debouncedSearchTerm, minSearchLength]);

  // Statistics for current filter
  const filterStats = useMemo(() => {
    return {
      total: filteredSiswa.length,
      byJenjang: {
        SMP: filteredSiswa.filter(s => {
          const k = kelas.find(kelas => kelas.id_kelas === s.id_kelas);
          return k?.jenjang === 'SMP';
        }).length,
        SMA: filteredSiswa.filter(s => {
          const k = kelas.find(kelas => kelas.id_kelas === s.id_kelas);
          return k?.jenjang === 'SMA';
        }).length
      }
    };
  }, [filteredSiswa, kelas]);

  return {
    filteredSiswa,
    isSearching,
    searchSuggestions,
    filterStats,
    debouncedSearchTerm
  };
};
