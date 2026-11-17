/**
 * AI Recommendation Engine
* Intelligent suggestions for administrative decisions including class assignments,
* interventions, capacity balancing, and data quality improvements.
*/

export interface StudentData {
  id_siswa: string;
  nis: string;
  nama: string;
  id_kelas: string;
  created_at: string;
}

export interface ClassData {
  id_kelas: string;
  nama_kelas: string;
  jenjang: string;
  kapasitas?: number;
}

export interface Recommendation {
  id: string;
  type: 'CLASS_ASSIGNMENT' | 'INTERVENTION' | 'CAPACITY' | 'DATA_QUALITY';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionable: boolean;
  actionLabel?: string;
  confidence: number;
  affectedItems: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  summary: string;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
}

class RecommendationEngine {
  private static instance: RecommendationEngine;

  private constructor() {}

  static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  /**
   * Generate class assignment recommendations
   */
  getClassAssignmentRecommendations(
    siswa: StudentData[],
    kelas: ClassData[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group siswa by class
    const classSizes = new Map<string, number>();
    siswa.forEach(s => {
      classSizes.set(s.id_kelas, (classSizes.get(s.id_kelas) || 0) + 1);
    });

    // Find over capacity classes
    for (const k of kelas) {
      const size = classSizes.get(k.id_kelas) || 0;
      const capacity = k.kapasitas || 40;

      if (size > capacity) {
        recommendations.push({
          id: `CAP_${k.id_kelas}`,
          type: 'CAPACITY',
          priority: 'high',
          title: `Kelas ${k.nama_kelas} Over-capacity`,
          description: `Kelas memiliki ${size} siswa melebihi kapasitas ${capacity}. Pertimbangkan pemindahan ${size - capacity} siswa ke kelas lain.`,
          actionable: true,
          actionLabel: 'Lihat Siswa',
          confidence: 0.9,
          affectedItems: [k.id_kelas],
        });
      } else if (size > capacity * 0.9) {
        recommendations.push({
          id: `CAP_WARN_${k.id_kelas}`,
          type: 'CAPACITY',
          priority: 'medium',
          title: `Kelas ${k.nama_kelas} Mendekati Kapasitas`,
          description: `Kelas memiliki ${size} siswa (${Math.round((size / capacity) * 100)}% kapasitas). Pertimbangkan untuk tidak menambah siswa baru.`,
          actionable: false,
          confidence: 0.8,
          affectedItems: [k.id_kelas],
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate intervention recommendations for at-risk students
   */
  getInterventionRecommendations(
    riskProfiles: Array<{ id_siswa: string; nama: string; dropoutRisk: number }>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const highRisk = riskProfiles.filter(p => p.dropoutRisk > 0.5);
    const mediumRisk = riskProfiles.filter(p => p.dropoutRisk > 0.3 && p.dropoutRisk <= 0.5);

    if (highRisk.length > 0) {
      recommendations.push({
        id: 'INTERVENTION_HIGH',
        type: 'INTERVENTION',
        priority: 'high',
        title: 'Siswa Berisiko Tinggi Membutuhkan Perhatian',
        description: `${highRisk.length} siswa memiliki risiko dropout tinggi (>50%). Disarankan untuk konseling akademik dan monitoring intensif.`,
        actionable: true,
        actionLabel: 'Lihat Daftar',
        confidence: 0.85,
        affectedItems: highRisk.map(s => s.id_siswa),
      });
    }

    if (mediumRisk.length > 5) {
      recommendations.push({
        id: 'INTERVENTION_MEDIUM',
        type: 'INTERVENTION',
        priority: 'medium',
        title: 'Siswa Berisiko Sedang',
        description: `${mediumRisk.length} siswa memiliki risiko sedang (30-50%). Pertimbangkan untuk program pendampingan.`,
        actionable: true,
        actionLabel: 'Lihat Daftar',
        confidence: 0.7,
        affectedItems: mediumRisk.map(s => s.id_siswa),
      });
    }

    return recommendations;
  }

  /**
   * Generate capacity balancing recommendations
   */
  getCapacityBalancingRecommendations(
    siswa: StudentData[],
    kelas: ClassData[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group by jenjang
    const jenjangClasses = new Map<string, ClassData[]>();
    kelas.forEach(k => {
      if (!jenjangClasses.has(k.jenjang)) {
        jenjangClasses.set(k.jenjang, []);
      }
      jenjangClasses.get(k.jenjang)!.push(k);
    });

    // Calculate class sizes by jenjang
    const classSizes = new Map<string, number>();
    siswa.forEach(s => {
      classSizes.set(s.id_kelas, (classSizes.get(s.id_kelas) || 0) + 1);
    });

    for (const [jenjang, classes] of jenjangClasses.entries()) {
      const sizes = classes.map(k => classSizes.get(k.id_kelas) || 0);
      const maxSize = Math.max(...sizes);
      const minSize = Math.min(...sizes);

      // If there's significant imbalance
      if (maxSize - minSize > 15) {
        const overCapacityClass = classes.find(k => classSizes.get(k.id_kelas) === maxSize);
        const underCapacityClass = classes.find(k => classSizes.get(k.id_kelas) === minSize);

        recommendations.push({
          id: `BALANCE_${jenjang}`,
          type: 'CAPACITY',
          priority: 'medium',
          title: `Imbalance Kelas Jenjang ${jenjang}`,
          description: `Perbedaan signifikan antara kelas terbanyak (${maxSize} siswa) dan terkecil (${minSize} siswa). Pertimbangkan redistribusi dari ${overCapacityClass?.nama_kelas} ke ${underCapacityClass?.nama_kelas}.`,
          actionable: true,
          actionLabel: 'Rekomendasi',
          confidence: 0.75,
          affectedItems: classes.map(k => k.id_kelas),
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate data quality recommendations
   */
  getDataQualityRecommendations(siswa: StudentData[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for invalid NIS formats
    const invalidNIS = siswa.filter(s => {
      const digits = s.nis.replace(/\D/g, '');
      return digits.length !== 8;
    });

    if (invalidNIS.length > 0) {
      recommendations.push({
        id: 'DATA_QUALITY_NIS',
        type: 'DATA_QUALITY',
        priority: 'high',
        title: 'NIS Format Tidak Valid',
        description: `${invalidNIS.length} siswa memiliki NIS dengan format tidak standar (bukan 8 digit). Perlu verifikasi dan koreksi.`,
        actionable: true,
        actionLabel: 'Lihat Data',
        confidence: 0.95,
        affectedItems: invalidNIS.map(s => s.id_siswa),
      });
    }

    // Check for empty names
    const emptyNames = siswa.filter(s => !s.nama || s.nama.trim() === '');
    if (emptyNames.length > 0) {
      recommendations.push({
        id: 'DATA_QUALITY_NAME',
        type: 'DATA_QUALITY',
        priority: 'high',
        title: 'Nama Siswa Kosong',
        description: `${emptyNames.length} siswa memiliki nama kosong. Data perlu dilengkapi.`,
        actionable: true,
        actionLabel: 'Perbaiki',
        confidence: 1.0,
        affectedItems: emptyNames.map(s => s.id_siswa),
      });
    }

    // Check for missing class assignment
    const missingClass = siswa.filter(s => !s.id_kelas || s.id_kelas.trim() === '');
    if (missingClass.length > 0) {
      recommendations.push({
        id: 'DATA_QUALITY_CLASS',
        type: 'DATA_QUALITY',
        priority: 'high',
        title: 'Siswa Tanpa Kelas',
        description: `${missingClass.length} siswa tidak memiliki kelas. Perlu ditetapkan kelasnya.`,
        actionable: true,
        actionLabel: 'Tetapkan Kelas',
        confidence: 1.0,
        affectedItems: missingClass.map(s => s.id_siswa),
      });
    }

    return recommendations;
  }

  /**
   * Generate all recommendations
   */
  generateRecommendations(
    siswa: StudentData[],
    kelas: ClassData[],
    riskProfiles?: Array<{ id_siswa: string; nama: string; dropoutRisk: number }>
  ): RecommendationResult {
    const recommendations: Recommendation[] = [];

    recommendations.push(...this.getClassAssignmentRecommendations(siswa, kelas));
    recommendations.push(...this.getCapacityBalancingRecommendations(siswa, kelas));
    recommendations.push(...this.getDataQualityRecommendations(siswa));

    if (riskProfiles) {
      recommendations.push(...this.getInterventionRecommendations(riskProfiles));
    }

    // Sort by priority (high first) then confidence
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return b.confidence - a.confidence;
    });

    const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
    const mediumPriorityCount = recommendations.filter(r => r.priority === 'medium').length;
    const lowPriorityCount = recommendations.filter(r => r.priority === 'low').length;

    const summaryParts: string[] = [];
    summaryParts.push(`Total ${recommendations.length} rekomendasi dihasilkan.`);

    if (highPriorityCount > 0) {
      summaryParts.push(`${highPriorityCount} prioritas tinggi.`);
    }
    if (mediumPriorityCount > 0) {
      summaryParts.push(`${mediumPriorityCount} prioritas sedang.`);
    }

    return {
      recommendations,
      summary: summaryParts.join(' '),
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
    };
  }

  /**
   * Get quick summary
   */
  getQuickSummary(result: RecommendationResult): {
    total: number;
    urgent: number;
    actionable: number;
  } {
    return {
      total: result.recommendations.length,
      urgent: result.highPriorityCount,
      actionable: result.recommendations.filter(r => r.actionable).length,
    };
  }
}

export const recommendationEngine = RecommendationEngine.getInstance();
export default RecommendationEngine;
