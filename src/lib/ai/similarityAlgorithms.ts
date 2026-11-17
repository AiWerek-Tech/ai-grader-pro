/**
 * Similarity Algorithms
 * Collection of string similarity and matching algorithms for AI-powered features.
 * No external dependencies - pure TypeScript implementations.
 */

/**
 * Levenshtein distance algorithm
 * Measures the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one string into another.
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],      // deletion
          dp[i][j - 1],      // insertion
          dp[i - 1][j - 1]    // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio based on Levenshtein distance
 * Returns 0-1 where 1 is identical
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Jaro-Winkler similarity algorithm
 * Optimized for comparing short strings like names
 * Gives higher weight to matching prefixes
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchDistance < 0) return 0;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (
    (matches / len1) +
    (matches / len2) +
    ((matches - transpositions / 2) / matches)
  ) / 3;

  // Winkler modification: boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Simple Soundex-like phonetic encoding for Indonesian names
 * Groups similar sounding characters together
 */
export function phoneticCode(str: string): string {
  const s = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length === 0) return '';

  const firstChar = s[0];
  const groups: Record<string, string> = {
    'B': '1', 'P': '1', 'F': '1', 'V': '1',
    'C': '2', 'S': '2', 'K': '2', 'G': '2', 'J': '2', 'Q': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6',
  };

  let code = firstChar;
  let prevCode = '';

  for (let i = 1; i < s.length; i++) {
    const char = s[i];
    const digit = groups[char] || '0';

    // Skip adjacent same codes and vowels (except first char)
    if (digit === prevCode || digit === '0') continue;

    code += digit;
    prevCode = digit;

    if (code.length >= 4) break;
  }

  return code.padEnd(4, '0');
}

/**
 * Check if two strings have similar phonetic codes
 */
export function phoneticSimilarity(str1: string, str2: string): boolean {
  return phoneticCode(str1) === phoneticCode(str2);
}

/**
 * NIS pattern similarity
 * Checks if two NIS values have similar digit patterns
 * Useful for detecting typos like 2024001 vs 2024002
 */
export function nisPatternSimilarity(nis1: string, nis2: string): number {
  if (nis1 === nis2) return 1;

  // Remove non-digits
  const d1 = nis1.replace(/\D/g, '');
  const d2 = nis2.replace(/\D/g, '');

  if (d1 === d2) return 1;

  // Check length
  if (d1.length !== d2.length) return 0;

  // Count matching positions
  let matches = 0;
  for (let i = 0; i < d1.length; i++) {
    if (d1[i] === d2[i]) matches++;
  }

  return matches / d1.length;
}

/**
 * Combined similarity score for names
 * Uses multiple algorithms and returns weighted average
 */
export function nameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();

  if (s1 === s2) return 1;

  const jaro = jaroWinklerSimilarity(s1, s2);
  const levenshtein = levenshteinSimilarity(s1, s2);
  const phonetic = phoneticSimilarity(s1, s2) ? 1 : 0;

  // Weighted average: Jaro-Winkler has highest weight for names
  return (jaro * 0.6) + (levenshtein * 0.3) + (phonetic * 0.1);
}

/**
 * Token-based similarity for multi-word names
 * Compares individual words and returns average similarity
 */
export function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = str1.toLowerCase().split(/\s+/);
  const tokens2 = str2.toLowerCase().split(/\s+/);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let totalSimilarity = 0;
  let comparisons = 0;

  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      totalSimilarity += nameSimilarity(t1, t2);
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}

/**
 * Find best match from a list of candidates
 */
export function findBestMatch(
  target: string,
  candidates: string[],
  threshold: number = 0.7
): { match: string; score: number } | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = nameSimilarity(target, candidate);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

/**
 * Batch similarity comparison
 * Returns all pairs above threshold
 */
export interface SimilarityPair {
  item1: string;
  item2: string;
  score: number;
}

export function findSimilarPairs(
  items: string[],
  threshold: number = 0.7
): SimilarityPair[] {
  const pairs: SimilarityPair[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = nameSimilarity(items[i], items[j]);
      if (score >= threshold) {
        pairs.push({ item1: items[i], item2: items[j], score });
      }
    }
  }

  // Sort by score descending
  return pairs.sort((a, b) => b.score - a.score);
}
