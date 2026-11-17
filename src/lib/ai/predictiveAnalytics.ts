/**
 * Predictive Analytics Engine
 * Predict student outcomes, analyze trends, and provide insights based on data patterns.
 * Uses statistical analysis and pattern recognition (no external ML libraries).
 */

export interface StudentData {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
  created_at: string;
  tahun_ajaran: string;
  semester: string;
}

export interface StudentRiskProfile {
  id_siswa: string;
  nama: string;
  dropoutRisk: number; // 0-1 probability
  riskFactors: string[];
  recommendedActions: string[];
  confidence: number;
}

export interface ClassPrediction {
  id_kelas: string;
  nama_kelas: string;
  currentSize: number;
  predictedSize: number;
  capacityRisk: 'low' | 'medium' | 'high';
  recommendedMax: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface EnrollmentTrend {
  period: string;
  total: number;
  byJenjang: Record<string, number>;
  growthRate: number;
}

export interface PredictiveInsights {
  riskProfiles: StudentRiskProfile[];
  classPredictions: ClassPrediction[];
  enrollmentTrends: EnrollmentTrend[];
  overallHealth: 'healthy' | 'concern' | 'critical';
  summary: string;
}

class PredictiveAnalytics {
  private static instance: PredictiveAnalytics;

  private constructor() {}

  static getInstance(): PredictiveAnalytics {
    if (!PredictiveAnalytics.instance) {
      PredictiveAnalytics.instance = new PredictiveAnalytics();
    }
    return PredictiveAnalytics.instance;
  }

  /**
   * Analyze student dropout risk based on enrollment patterns
   */
  analyzeDropoutRisk(siswa: StudentData[], kelas: any[]): StudentRiskProfile[] {
    const profiles: StudentRiskProfile[] = [];

    // Group by class to check size
    const classSizes = new Map<string, number>();
    siswa.forEach(s => {
      classSizes.set(s.id_kelas, (classSizes.get(s.id_kelas) || 0) + 1);
    });

    for (const s of siswa) {
      const riskFactors: string[] = [];
      let riskScore = 0;
      let confidence = 0.5;

      const classSize = classSizes.get(s.id_kelas) || 0;
      const kelasData = kelas.find(k => k.id_kelas === s.id_kelas);

      // Factor 1: Class size (overcrowding increases risk)
      if (classSize > 40) {
        riskFactors.push('Kelas terlalu penuh (>40 siswa)');
        riskScore += 0.3;
      } else if (classSize > 35) {
        riskFactors.push('Kelas mendekati kapasitas maksimum');
        riskScore += 0.15;
      }

      // Factor 2: Enrollment timing (late enrollment increases risk)
      const enrollmentDate = new Date(s.created_at);
      const currentYear = new Date().getFullYear();
      const enrollmentYear = enrollmentDate.getFullYear();
      const isLateEnrollment = enrollmentYear === currentYear && enrollmentDate.getMonth() > 6; // After July

      if (isLateEnrollment) {
        riskFactors.push('Enroll terlambat dalam tahun ajaran');
        riskScore += 0.25;
      }

      // Factor 3: Class level (higher levels have slightly higher dropout risk)
      if (kelasData?.jenjang === 'SMA') {
        riskScore += 0.05;
      }

      // Factor 4: Check if NIS pattern is unusual (potential data quality issue)
      const nis = s.nis.replace(/\D/g, '');
      if (nis.length !== 8) {
        riskFactors.push('NIS format tidak standar');
        riskScore += 0.1;
      }

      // Cap risk score
      riskScore = Math.min(riskScore, 1);

      // Determine recommended actions
      const recommendedActions: string[] = [];
      if (riskScore > 0.5) {
        recommendedActions.push('Perlu monitoring khusus');
        recommendedActions.push('Pertimbangkan konseling akademik');
      }
      if (classSize > 40) {
        recommendedActions.push('Pertimbangkan pemindahan ke kelas lain');
      }

      // Adjust confidence based on data availability
      confidence = Math.min(confidence + (riskFactors.length * 0.1), 0.9);

      if (riskScore > 0.2) {
        profiles.push({
          id_siswa: s.id_siswa,
          nama: s.nama,
          dropoutRisk: riskScore,
          riskFactors,
          recommendedActions,
          confidence,
        });
      }
    }

    // Sort by risk descending
    return profiles.sort((a, b) => b.dropoutRisk - a.dropoutRisk);
  }

  /**
   * Predict class sizes based on historical trends
   */
  predictClassSizes(siswa: StudentData[], kelas: any[]): ClassPrediction[] {
    const predictions: ClassPrediction[] = [];

    // Group siswa by class
    const classGroups = new Map<string, StudentData[]>();
    siswa.forEach(s => {
      if (!classGroups.has(s.id_kelas)) {
        classGroups.set(s.id_kelas, []);
      }
      classGroups.get(s.id_kelas)!.push(s);
    });

    for (const k of kelas) {
      const siswaInClass = classGroups.get(k.id_kelas) || [];
      const currentSize = siswaInClass.length;

      // Calculate trend based on enrollment timing
      const recentEnrollments = siswaInClass.filter(
        s => {
          const daysSinceEnrollment = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceEnrollment < 30;
        }
      ).length;

      const midTermEnrollments = siswaInClass.filter(
        s => {
          const daysSinceEnrollment = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceEnrollment >= 30 && daysSinceEnrollment < 90;
        }
      ).length;

      // Predict growth based on recent vs mid-term enrollment ratio
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      let predictedGrowth = 0;

      if (recentEnrollments > midTermEnrollments * 1.5) {
        trend = 'increasing';
        predictedGrowth = Math.ceil(recentEnrollments * 0.5);
      } else if (recentEnrollments < midTermEnrollments * 0.5) {
        trend = 'decreasing';
        predictedGrowth = -Math.ceil(midTermEnrollments * 0.1);
      }

      const predictedSize = Math.max(0, currentSize + predictedGrowth);

      // Determine capacity risk
      let capacityRisk: 'low' | 'medium' | 'high' = 'low';
      let recommendedMax = 40;

      if (predictedSize > 40) {
        capacityRisk = 'high';
        recommendedMax = 35;
      } else if (predictedSize > 35) {
        capacityRisk = 'medium';
        recommendedMax = 38;
      }

      predictions.push({
        id_kelas: k.id_kelas,
        nama_kelas: k.nama_kelas,
        currentSize,
        predictedSize,
        capacityRisk,
        recommendedMax,
        trend,
      });
    }

    return predictions.sort((a, b) => b.capacityRisk === 'high' ? 1 : -1);
  }

  /**
   * Analyze enrollment trends over time
   */
  analyzeEnrollmentTrends(siswa: StudentData[]): EnrollmentTrend[] {
    const trends: EnrollmentTrend[] = [];

    // Group by month
    const monthlyData = new Map<string, StudentData[]>();
    siswa.forEach(s => {
      const date = new Date(s.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData.has(key)) {
        monthlyData.set(key, []);
      }
      monthlyData.get(key)!.push(s);
    });

    // Sort by month
    const sortedMonths = Array.from(monthlyData.keys()).sort();

    let previousTotal = 0;
    for (const month of sortedMonths) {
      const siswaInMonth = monthlyData.get(month)!;
      const total = siswaInMonth.length;

      const byJenjang: Record<string, number> = {};
      siswaInMonth.forEach(() => {
        // jenjang would need to be looked up from kelas data
        // For now, we'll use a placeholder
        byJenjang['Unknown'] = (byJenjang['Unknown'] || 0) + 1;
      });

      const growthRate = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

      trends.push({
        period: month,
        total,
        byJenjang,
        growthRate,
      });

      previousTotal = total;
    }

    return trends;
  }

  /**
   * Generate comprehensive predictive insights
   */
  generateInsights(siswa: StudentData[], kelas: any[]): PredictiveInsights {
    const riskProfiles = this.analyzeDropoutRisk(siswa, kelas);
    const classPredictions = this.predictClassSizes(siswa, kelas);
    const enrollmentTrends = this.analyzeEnrollmentTrends(siswa);

    // Determine overall health
    const highRiskStudents = riskProfiles.filter(p => p.dropoutRisk > 0.5).length;
    const overCapacityClasses = classPredictions.filter(p => p.capacityRisk === 'high').length;

    let overallHealth: 'healthy' | 'concern' | 'critical' = 'healthy';
    if (highRiskStudents > siswa.length * 0.2 || overCapacityClasses > kelas.length * 0.3) {
      overallHealth = 'critical';
    } else if (highRiskStudents > siswa.length * 0.1 || overCapacityClasses > kelas.length * 0.15) {
      overallHealth = 'concern';
    }

    // Generate summary
    const summaryParts: string[] = [];
    summaryParts.push(`Total ${siswa.length} siswa dianalisis.`);

    if (highRiskStudents > 0) {
      summaryParts.push(`${highRiskStudents} siswa berisiko dropout tinggi.`);
    }

    if (overCapacityClasses > 0) {
      summaryParts.push(`${overCapacityClasses} kelas diprediksi over-capacity.`);
    }

    if (overallHealth === 'healthy') {
      summaryParts.push('Secara keseluruhan, sistem dalam kondisi sehat.');
    } else if (overallHealth === 'concern') {
      summaryParts.push('Perlu perhatian pada beberapa area.');
    } else {
      summaryParts.push('Sistem memerlukan intervensi segera.');
    }

    return {
      riskProfiles,
      classPredictions,
      enrollmentTrends,
      overallHealth,
      summary: summaryParts.join(' '),
    };
  }

  /**
   * Get quick stats for dashboard
   */
  getQuickStats(insights: PredictiveInsights): {
    totalSiswa: number;
    highRiskCount: number;
    overCapacityClasses: number;
    increasingTrends: number;
  } {
    return {
      totalSiswa: insights.riskProfiles.length,
      highRiskCount: insights.riskProfiles.filter(p => p.dropoutRisk > 0.5).length,
      overCapacityClasses: insights.classPredictions.filter(p => p.capacityRisk === 'high').length,
      increasingTrends: insights.classPredictions.filter(p => p.trend === 'increasing').length,
    };
  }
}

export const predictiveAnalytics = PredictiveAnalytics.getInstance();
export default PredictiveAnalytics;
