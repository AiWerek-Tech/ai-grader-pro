/**
 * Natural Language Query Service
 * Allows users to query siswa data using plain Indonesian language.
 * Parses questions and converts them to filter operations.
 */

export interface StudentData {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
}

export interface QueryFilter {
  searchTerm?: string;
  id_kelas?: string;
  jenjang?: string;
  sortBy?: 'nama' | 'nis' | 'kelas' | 'created';
  sortOrder?: 'asc' | 'desc';
}

export interface QueryResult {
  success: boolean;
  filter: QueryFilter;
  message: string;
  confidence: number;
  fallback?: boolean;
}

class NaturalLanguageQuery {
  private static instance: NaturalLanguageQuery;

  private patterns: Array<{
    pattern: RegExp;
    handler: (match: RegExpMatchArray, kelas: any[]) => QueryFilter;
    confidence: number;
  }> = [];

  private constructor() {
    this.initializePatterns();
  }

  static getInstance(): NaturalLanguageQuery {
    if (!NaturalLanguageQuery.instance) {
      NaturalLanguageQuery.instance = new NaturalLanguageQuery();
    }
    return NaturalLanguageQuery.instance;
  }

  private initializePatterns(): void {
    // Pattern: "Berapa siswa kelas [X]?" or "Tampilkan siswa kelas [X]"
    this.patterns.push({
      pattern: /(?:berapa|tampilkan|lihat|cari)\s+(?:siswa\s+)?kelas\s+(\w+)/i,
      handler: (match, kelas) => {
        const className = match[1];
        const kelasData = kelas.find(k =>
          k.nama_kelas.toLowerCase().includes(className.toLowerCase()) ||
          k.id_kelas.toLowerCase().includes(className.toLowerCase())
        );
        return {
          id_kelas: kelasData?.id_kelas,
          searchTerm: '',
        };
      },
      confidence: 0.9,
    });

    // Pattern: "Siswa dengan NIS [X]"
    this.patterns.push({
      pattern: /(?:siswa\s+)?(?:dengan\s+)?nis\s+(\d+)/i,
      handler: (match) => ({
        searchTerm: match[1],
        sortBy: 'nis',
      }),
      confidence: 0.95,
    });

    // Pattern: "Siswa bernama [X]"
    this.patterns.push({
      pattern: /(?:siswa\s+)?(?:ber)?nama\s+(.+)/i,
      handler: (match) => ({
        searchTerm: match[1].trim(),
        sortBy: 'nama',
      }),
      confidence: 0.85,
    });

    // Pattern: "Siswa jenjang [SMP/SMA]"
    this.patterns.push({
      pattern: /(?:siswa\s+)?jenjang\s+(smp|sma)/i,
      handler: (match) => ({
        jenjang: match[1].toUpperCase(),
      }),
      confidence: 0.9,
    });

    // Pattern: "Urutkan berdasarkan [nama/nis/kelas]"
    this.patterns.push({
      pattern: /(?:urutkan|sort)\s+(?:berdasarkan\s+)?(nama|nis|kelas)/i,
      handler: (match) => {
        const sortByMap: Record<string, 'nama' | 'nis' | 'kelas'> = {
          nama: 'nama',
          nis: 'nis',
          kelas: 'kelas',
        };
        return {
          sortBy: sortByMap[match[1].toLowerCase()] || 'nama',
          sortOrder: 'asc',
        };
      },
      confidence: 0.8,
    });

    // Pattern: "Semua siswa" or "Tampilkan semua"
    this.patterns.push({
      pattern: /(?:semua\s+)?siswa|tampilkan\s+semua/i,
      handler: () => ({}),
      confidence: 0.7,
    });
  }

  /**
   * Parse natural language query
   */
  parseQuery(query: string, kelas: any[]): QueryResult {
    const trimmedQuery = query.trim();
    let bestMatch: { filter: QueryFilter; confidence: number; pattern?: RegExp } | null = null;

    // Try all patterns
    for (const { pattern, handler, confidence } of this.patterns) {
      const match = trimmedQuery.match(pattern);
      if (match) {
        const filter = handler(match, kelas);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { filter, confidence, pattern };
        }
      }
    }

    if (bestMatch) {
      return {
        success: true,
        filter: bestMatch.filter,
        message: this.generateSuccessMessage(bestMatch.filter, kelas),
        confidence: bestMatch.confidence,
        fallback: false,
      };
    }

    // Fallback: treat as search term
    return {
      success: true,
      filter: { searchTerm: trimmedQuery },
      message: `Mencari: "${trimmedQuery}"`,
      confidence: 0.5,
      fallback: true,
    };
  }

  /**
   * Generate success message based on filter
   */
  private generateSuccessMessage(filter: QueryFilter, kelas: any[]): string {
    const parts: string[] = [];

    if (filter.id_kelas) {
      const kelasData = kelas.find(k => k.id_kelas === filter.id_kelas);
      parts.push(`Kelas: ${kelasData?.nama_kelas || filter.id_kelas}`);
    }

    if (filter.jenjang) {
      parts.push(`Jenjang: ${filter.jenjang}`);
    }

    if (filter.searchTerm) {
      parts.push(`Pencarian: "${filter.searchTerm}"`);
    }

    if (filter.sortBy) {
      parts.push(`Urut: ${filter.sortBy}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Menampilkan semua siswa';
  }

  /**
   * Get suggested queries for the current context
   */
  getSuggestedQueries(kelas: any[]): string[] {
    const suggestions: string[] = [
      'Berapa siswa kelas 7A?',
      'Siswa dengan NIS 2024001',
      'Siswa bernama Ahmad',
      'Siswa jenjang SMP',
      'Urutkan berdasarkan nama',
    ];

    // Add class-specific suggestions
    if (kelas.length > 0) {
      const firstClass = kelas[0];
      suggestions.push(`Siswa kelas ${firstClass.nama_kelas}`);
    }

    return suggestions;
  }

  /**
   * Get query examples
   */
  getQueryExamples(): Array<{ query: string; description: string }> {
    return [
      { query: 'Berapa siswa kelas 7A?', description: 'Hitung siswa di kelas tertentu' },
      { query: 'Siswa dengan NIS 2024001', description: 'Cari berdasarkan NIS' },
      { query: 'Siswa bernama Ahmad', description: 'Cari berdasarkan nama' },
      { query: 'Siswa jenjang SMP', description: 'Filter berdasarkan jenjang' },
      { query: 'Urutkan berdasarkan nama', description: 'Sort hasil' },
      { query: 'Tampilkan semua siswa', description: 'Reset filter' },
    ];
  }
}

export const naturalLanguageQuery = NaturalLanguageQuery.getInstance();
export default NaturalLanguageQuery;
