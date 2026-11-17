/**
 * AI Dashboard Component
 * Visualizes AI insights including duplicate detection, predictive analytics,
 * recommendations, and anomaly detection in a user-friendly interface.
 */

'use client';

import { X, Brain, AlertTriangle, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';

interface AIDashboardProps {
  duplicates: any;
  predictions: any;
  recommendations: any;
  anomalies: any;
  loading: boolean;
  onClose: () => void;
  onRunAnalyses: () => void;
}

export default function AIDashboard({
  duplicates,
  predictions,
  recommendations,
  anomalies,
  loading,
  onClose,
  onRunAnalyses,
}: AIDashboardProps) {
  const quickSummary = {
    duplicates: duplicates?.duplicatesFound || 0,
    highRisk: predictions?.riskProfiles?.filter((p: any) => p.dropoutRisk > 0.5).length || 0,
    recommendations: recommendations?.highPriorityCount || 0,
    anomalies: (anomalies?.criticalCount || 0) + (anomalies?.highCount || 0),
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-sm z-[130] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-5xl rounded-[3rem] p-10 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="mb-8">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
              <Brain className="w-6 h-6" />
            </span>
            AI Insights Dashboard
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-semibold">
            Analisis cerdas untuk data siswa
          </p>
        </div>

        {/* Quick Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Duplikat', value: quickSummary.duplicates, icon: AlertTriangle, color: 'text-amber-500' },
            { label: 'High Risk', value: quickSummary.highRisk, icon: TrendingUp, color: 'text-rose-500' },
            { label: 'Rekomendasi', value: quickSummary.recommendations, icon: CheckCircle, color: 'text-emerald-500' },
            { label: 'Anomali', value: quickSummary.anomalies, icon: AlertTriangle, color: 'text-violet-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-4 text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={onRunAnalyses}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            Jalankan Analisis AI
          </button>
        </div>

        {/* Duplicate Detection */}
        {duplicates && (
          <div className="mb-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Deteksi Duplikat
            </h4>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                {duplicates.duplicatesFound} duplikat ditemukan ({duplicates.exactDuplicates} exact, {duplicates.fuzzyMatches} fuzzy)
              </div>
              {duplicates.matches?.slice(0, 3).map((match: any, i: number) => (
                <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400 py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                  <span className="font-semibold">{match.primary.nama}</span> - {match.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predictive Analytics */}
        {predictions && (
          <div className="mb-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-500" />
              Prediksi Risiko
            </h4>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                Status: {predictions.overallHealth}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                {predictions.summary}
              </div>
              {predictions.riskProfiles?.slice(0, 3).map((profile: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">{profile.nama}</span>
                  <span className={`text-[10px] font-black ${profile.dropoutRisk > 0.5 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {Math.round(profile.dropoutRisk * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && (
          <div className="mb-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Rekomendasi AI
            </h4>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                {recommendations.summary}
              </div>
              {recommendations.recommendations?.slice(0, 3).map((rec: any, i: number) => (
                <div key={i} className="py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${rec.priority === 'high' ? 'bg-rose-500' : rec.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{rec.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anomaly Detection */}
        {anomalies && (
          <div className="mb-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-violet-500" />
              Deteksi Anomali
            </h4>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                {anomalies.summary}
              </div>
              {anomalies.anomalies?.slice(0, 3).map((anomaly: any, i: number) => (
                <div key={i} className="py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${anomaly.severity === 'critical' ? 'bg-rose-500' : anomaly.severity === 'high' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{anomaly.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{anomaly.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-indigo-500 mt-0.5" />
            <div>
              <div className="text-xs font-black text-indigo-900 dark:text-indigo-300 mb-1">Tentang AI Insights</div>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-400">
                Analisis AI berjalan di browser Anda tanpa mengirim data ke server eksternal. Semua data tetap aman dan privat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
