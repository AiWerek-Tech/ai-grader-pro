/**
 * AI Insights Hook
 * Central hook for accessing all AI-powered features including
 * duplicate detection, predictive analytics, recommendations, and anomaly detection.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { mlDuplicateDetector, type DuplicateDetectionResult } from '@/lib/ai/mlDuplicateDetector';
import { predictiveAnalytics, type PredictiveInsights } from '@/lib/ai/predictiveAnalytics';
import { recommendationEngine, type RecommendationResult } from '@/lib/ai/recommendationEngine';
import { anomalyDetector, type AnomalyReport } from '@/lib/ai/anomalyDetector';
import { naturalLanguageQuery, type QueryResult } from '@/lib/ai/naturalLanguageQuery';

export interface AIInsightsState {
  duplicates: DuplicateDetectionResult | null;
  predictions: PredictiveInsights | null;
  recommendations: RecommendationResult | null;
  anomalies: AnomalyReport | null;
  loading: boolean;
  error: string | null;
}

export interface UseAIInsightsOptions {
  enableDuplicates?: boolean;
  enablePredictions?: boolean;
  enableRecommendations?: boolean;
  enableAnomalies?: boolean;
  autoRun?: boolean; // If true, auto-run when data changes (default: false for manual trigger)
}

export function useAIInsights(
  siswa: any[],
  kelas: any[],
  options: UseAIInsightsOptions = {}
) {
  const [state, setState] = useState<AIInsightsState>({
    duplicates: null,
    predictions: null,
    recommendations: null,
    anomalies: null,
    loading: false,
    error: null,
  });

  const {
    enableDuplicates = true,
    enablePredictions = true,
    enableRecommendations = true,
    enableAnomalies = true,
    autoRun = false, // Default to manual trigger to prevent UI blocking
  } = options;

  /**
   * Run duplicate detection
   */
  const runDuplicateDetection = useCallback(() => {
    if (!enableDuplicates) return;

    try {
      const candidates = siswa.map(s => ({
        id_siswa: s.id_siswa,
        nis: s.nis,
        nama: s.nama,
        id_kelas: s.id_kelas,
      }));

      const result = mlDuplicateDetector.detectDuplicates(candidates);
      setState(prev => ({ ...prev, duplicates: result }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `Duplicate detection error: ${error.message}` }));
    }
  }, [siswa, enableDuplicates]);

  /**
   * Run predictive analytics
   */
  const runPredictiveAnalytics = useCallback(() => {
    if (!enablePredictions) return;

    try {
      const studentData = siswa.map(s => ({
        id_siswa: s.id_siswa,
        nis: s.nis,
        nama: s.nama,
        id_kelas: s.id_kelas,
        created_at: s.created_at || new Date().toISOString(),
        tahun_ajaran: s.tahun_ajaran || '',
        semester: s.semester || '',
      }));

      const insights = predictiveAnalytics.generateInsights(studentData, kelas);
      setState(prev => ({ ...prev, predictions: insights }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `Predictive analytics error: ${error.message}` }));
    }
  }, [siswa, kelas, enablePredictions]);

  /**
   * Run recommendations
   */
  const runRecommendations = useCallback(() => {
    if (!enableRecommendations) return;

    try {
      const studentData = siswa.map(s => ({
        id_siswa: s.id_siswa,
        nis: s.nis,
        nama: s.nama,
        id_kelas: s.id_kelas,
        created_at: s.created_at || new Date().toISOString(),
      }));

      const classData = kelas.map(k => ({
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        jenjang: k.jenjang,
        kapasitas: k.kapasitas || 40,
      }));

      const riskProfiles = state.predictions?.riskProfiles || [];
      const result = recommendationEngine.generateRecommendations(studentData, classData, riskProfiles);
      setState(prev => ({ ...prev, recommendations: result }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `Recommendations error: ${error.message}` }));
    }
  }, [siswa, kelas, state.predictions, enableRecommendations]);

  /**
   * Run anomaly detection
   */
  const runAnomalyDetection = useCallback(() => {
    if (!enableAnomalies) return;

    try {
      const studentData = siswa.map(s => ({
        id_siswa: s.id_siswa,
        nis: s.nis,
        nama: s.nama,
        id_kelas: s.id_kelas,
        created_at: s.created_at || new Date().toISOString(),
        tahun_ajaran: s.tahun_ajaran || '',
        semester: s.semester || '',
      }));

      const report = anomalyDetector.detectAnomalies(studentData, kelas);
      setState(prev => ({ ...prev, anomalies: report }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: `Anomaly detection error: ${error.message}` }));
    }
  }, [siswa, kelas, enableAnomalies]);

  /**
   * Run all AI analyses
   */
  const runAllAnalyses = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      runDuplicateDetection();
      runPredictiveAnalytics();
      runRecommendations();
      runAnomalyDetection();
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [runDuplicateDetection, runPredictiveAnalytics, runRecommendations, runAnomalyDetection]);

  /**
   * Parse natural language query
   */
  const parseQuery = useCallback((query: string): QueryResult => {
    return naturalLanguageQuery.parseQuery(query, kelas);
  }, [kelas]);

  /**
   * Get quick summary
   */
  const getQuickSummary = useCallback(() => {
    const summary: Record<string, any> = {};

    if (state.duplicates) {
      summary.duplicates = state.duplicates.duplicatesFound;
    }

    if (state.predictions) {
      summary.highRisk = state.predictions.riskProfiles.filter(p => p.dropoutRisk > 0.5).length;
    }

    if (state.recommendations) {
      summary.recommendations = state.recommendations.highPriorityCount;
    }

    if (state.anomalies) {
      summary.anomalies = state.anomalies.criticalCount + state.anomalies.highCount;
    }

    return summary;
  }, [state]);

  // Auto-run when data changes (only if autoRun option is enabled)
  useEffect(() => {
    if (autoRun && siswa.length > 0 && kelas.length > 0) {
      const timer = setTimeout(() => {
        runAllAnalyses();
      }, 1000); // 1 second delay

      return () => clearTimeout(timer);
    }
  }, [siswa, kelas, autoRun, runAllAnalyses]);

  return {
    ...state,
    runAllAnalyses,
    runDuplicateDetection,
    runPredictiveAnalytics,
    runRecommendations,
    runAnomalyDetection,
    parseQuery,
    getQuickSummary,
  };
}
