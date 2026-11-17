/**
 * ML Duplicate Detection Service
 * Advanced duplicate detection using fuzzy string matching and similarity algorithms.
 * Identifies potential duplicates beyond exact NIS matches.
 */

import {
  nameSimilarity,
  nisPatternSimilarity,
  findSimilarPairs,
} from './similarityAlgorithms';

export interface DuplicateCandidate {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
}

export interface DuplicateMatch {
  primary: DuplicateCandidate;
  duplicates: DuplicateCandidate[];
  matchType: 'EXACT_NIS' | 'SIMILAR_NIS' | 'SIMILAR_NAME' | 'COMBINED';
  confidence: number;
  suggestedAction: 'MERGE' | 'KEEP_BOTH' | 'MANUAL_REVIEW';
  reason: string;
}

export interface DuplicateDetectionResult {
  totalRecords: number;
  duplicatesFound: number;
  exactDuplicates: number;
  fuzzyMatches: number;
  matches: DuplicateMatch[];
  processingTime: number;
}

export interface DetectionOptions {
  nameThreshold?: number;
  nisThreshold?: number;
  includeExactOnly?: boolean;
  checkClass?: boolean;
}

class MLDuplicateDetector {
  private static instance: MLDuplicateDetector;

  private constructor() {}

  static getInstance(): MLDuplicateDetector {
    if (!MLDuplicateDetector.instance) {
      MLDuplicateDetector.instance = new MLDuplicateDetector();
    }
    return MLDuplicateDetector.instance;
  }

  /**
   * Detect duplicates in siswa dataset
   */
  detectDuplicates(
    siswa: DuplicateCandidate[],
    options: DetectionOptions = {}
  ): DuplicateDetectionResult {
    const startTime = Date.now();

    const nameThreshold = options.nameThreshold ?? 0.8;
    const nisThreshold = options.nisThreshold ?? 0.9;
    const checkClass = options.checkClass ?? true;

    const matches: DuplicateMatch[] = [];
    const processed = new Set<string>();
    const exactDuplicates: DuplicateMatch[] = [];
    const fuzzyMatches: DuplicateMatch[] = [];

    // Group by exact NIS first
    const nisGroups = new Map<string, DuplicateCandidate[]>();
    for (const s of siswa) {
      const nis = s.nis.trim();
      if (!nisGroups.has(nis)) {
        nisGroups.set(nis, []);
      }
      nisGroups.get(nis)!.push(s);
    }

    // Find exact NIS duplicates
    for (const [, group] of nisGroups.entries()) {
      if (group.length > 1) {
        const primary = group[0];
        const duplicates = group.slice(1);
        exactDuplicates.push({
          primary,
          duplicates,
          matchType: 'EXACT_NIS',
          confidence: 1.0,
          suggestedAction: 'MERGE',
          reason: 'NIS identik persis',
        });
        group.forEach(s => processed.add(s.id_siswa));
      }
    }

    // If only checking exact duplicates, return early
    if (options.includeExactOnly) {
      return {
        totalRecords: siswa.length,
        duplicatesFound: exactDuplicates.length,
        exactDuplicates: exactDuplicates.length,
        fuzzyMatches: 0,
        matches: exactDuplicates,
        processingTime: Date.now() - startTime,
      };
    }

    // Find fuzzy matches for unprocessed records
    const unprocessed = siswa.filter(s => !processed.has(s.id_siswa));

    // Compare names for fuzzy matches
    const names = unprocessed.map(s => s.nama);
    const namePairs = findSimilarPairs(names, nameThreshold);

    // Build match groups from name pairs
    const nameGroups = new Map<string, DuplicateCandidate[]>();
    for (const pair of namePairs) {
      const s1 = unprocessed.find(s => s.nama === pair.item1);
      const s2 = unprocessed.find(s => s.nama === pair.item2);
      if (!s1 || !s2) continue;

      const key = pair.item1 < pair.item2 ? pair.item1 : pair.item2;
      if (!nameGroups.has(key)) {
        nameGroups.set(key, []);
      }
      nameGroups.get(key)!.push(s1, s2);
    }

    // Process name-based groups
    for (const group of nameGroups.values()) {
      const unique = Array.from(new Map(group.map(s => [s.id_siswa, s])).values());
      if (unique.length < 2) continue;

      const primary = unique[0];
      const duplicates = unique.slice(1);

      // Check class only when enabled
      const sameClass = checkClass ? duplicates.every(d => d.id_kelas === primary.id_kelas) : true;
      const confidence = nameSimilarity(primary.nama, duplicates[0].nama);

      fuzzyMatches.push({
        primary,
        duplicates,
        matchType: 'SIMILAR_NAME',
        confidence,
        suggestedAction: confidence > 0.9 && sameClass ? 'MERGE' : 'MANUAL_REVIEW',
        reason: `Nama mirip (${Math.round(confidence * 100)}% similarity)${sameClass ? ', kelas sama' : ', kelas beda'}`,
      });
    }

    // Find NIS pattern matches (typos like 2024001 vs 2024002)
    for (let i = 0; i < unprocessed.length; i++) {
      for (let j = i + 1; j < unprocessed.length; j++) {
        const s1 = unprocessed[i];
        const s2 = unprocessed[j];

        const nisScore = nisPatternSimilarity(s1.nis, s2.nis);
        if (nisScore >= nisThreshold && nisScore < 1) {
          // Check if already matched
          const alreadyMatched = matches.some(
            m =>
              m.primary.id_siswa === s1.id_siswa ||
              m.duplicates.some(d => d.id_siswa === s1.id_siswa) ||
              m.primary.id_siswa === s2.id_siswa ||
              m.duplicates.some(d => d.id_siswa === s2.id_siswa)
          );

          if (!alreadyMatched) {
            fuzzyMatches.push({
              primary: s1,
              duplicates: [s2],
              matchType: 'SIMILAR_NIS',
              confidence: nisScore,
              suggestedAction: 'MANUAL_REVIEW',
              reason: `NIS pola mirip (${Math.round(nisScore * 100)}% match)`,
            });
          }
        }
      }
    }

    // Combine all matches
    const allMatches = [...exactDuplicates, ...fuzzyMatches];

    return {
      totalRecords: siswa.length,
      duplicatesFound: allMatches.length,
      exactDuplicates: exactDuplicates.length,
      fuzzyMatches: fuzzyMatches.length,
      matches: allMatches,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Get statistics on duplicate detection
   */
  getStats(result: DuplicateDetectionResult): {
    duplicateRate: number;
    avgConfidence: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
  } {
    const duplicateRate = (result.duplicatesFound / result.totalRecords) * 100;
    const avgConfidence =
      result.matches.length > 0
        ? result.matches.reduce((sum, m) => sum + m.confidence, 0) / result.matches.length
        : 0;

    const highConfidence = result.matches.filter(m => m.confidence >= 0.9).length;
    const mediumConfidence = result.matches.filter(m => m.confidence >= 0.7 && m.confidence < 0.9).length;
    const lowConfidence = result.matches.filter(m => m.confidence < 0.7).length;

    return {
      duplicateRate,
      avgConfidence,
      highConfidenceCount: highConfidence,
      mediumConfidenceCount: mediumConfidence,
      lowConfidenceCount: lowConfidence,
    };
  }

  /**
   * Get recommended merge actions
   */
  getMergeRecommendations(result: DuplicateDetectionResult): {
    autoMerge: DuplicateMatch[];
    manualReview: DuplicateMatch[];
    keepBoth: DuplicateMatch[];
  } {
    return {
      autoMerge: result.matches.filter(m => m.suggestedAction === 'MERGE'),
      manualReview: result.matches.filter(m => m.suggestedAction === 'MANUAL_REVIEW'),
      keepBoth: result.matches.filter(m => m.suggestedAction === 'KEEP_BOTH'),
    };
  }
}

export const mlDuplicateDetector = MLDuplicateDetector.getInstance();
export default MLDuplicateDetector;
