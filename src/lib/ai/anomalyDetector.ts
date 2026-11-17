/**
 * Anomaly Detection System
 * Automatic detection of unusual patterns in student data including
 * enrollment spikes, unusual NIS patterns, inconsistent class assignments,
 * and data quality monitoring.
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

export interface Anomaly {
  id: string;
  type: 'ENROLLMENT_SPIKE' | 'NIS_PATTERN' | 'CLASS_ASSIGNMENT' | 'DATA_QUALITY' | 'TEMPORAL';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedItems: string[];
  timestamp: string;
  suggestedAction?: string;
  confidence: number;
}

export interface AnomalyReport {
  anomalies: Anomaly[];
  summary: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  lastChecked: string;
}

class AnomalyDetector {
  private static instance: AnomalyDetector;
  private historicalData: Map<string, number[]> = new Map();
  private anomalyHistory: Anomaly[] = [];

  private constructor() {}

  static getInstance(): AnomalyDetector {
    if (!AnomalyDetector.instance) {
      AnomalyDetector.instance = new AnomalyDetector();
    }
    return AnomalyDetector.instance;
  }

  /**
   * Detect enrollment anomalies (sudden spikes/drops)
   */
  detectEnrollmentAnomalies(siswa: StudentData[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Group by date
    const dailyEnrollments = new Map<string, number>();
    siswa.forEach(s => {
      const date = new Date(s.created_at).toISOString().split('T')[0];
      dailyEnrollments.set(date, (dailyEnrollments.get(date) || 0) + 1);
    });

    const dates = Array.from(dailyEnrollments.keys()).sort();
    const enrollments = dates.map(d => dailyEnrollments.get(d)!);

    if (enrollments.length < 3) return anomalies;

    // Calculate mean and standard deviation
    const mean = enrollments.reduce((a, b) => a + b, 0) / enrollments.length;
    const variance = enrollments.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / enrollments.length;
    const stdDev = Math.sqrt(variance);

    // Detect outliers (2+ standard deviations from mean)
    for (let i = 0; i < dates.length; i++) {
      const value = enrollments[i];
      const zScore = stdDev > 0 ? Math.abs((value - mean) / stdDev) : 0;

      if (zScore > 2) {
        const severity = zScore > 3 ? 'high' : 'medium';
        const isSpike = value > mean;

        anomalies.push({
          id: `ENROLL_${dates[i]}`,
          type: 'ENROLLMENT_SPIKE',
          severity,
          title: isSpike ? 'Spike Pendaftaran Terdeteksi' : 'Penurunan Pendaftaran Terdeteksi',
          description: `Pada ${dates[i]}, terjadi ${isSpike ? 'spike' : 'penurunan'} pendaftaran (${value} siswa, ${zScore.toFixed(1)}σ dari rata-rata).`,
          affectedItems: [],
          timestamp: new Date().toISOString(),
          suggestedAction: isSpike ? 'Verifikasi keabsahan data pendaftaran' : 'Investigasi penyebab penurunan',
          confidence: Math.min(zScore / 3, 1),
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect unusual NIS patterns
   */
  detectNISAnomalies(siswa: StudentData[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for non-standard NIS formats
    const invalidNIS = siswa.filter(s => {
      const digits = s.nis.replace(/\D/g, '');
      return digits.length !== 8;
    });

    if (invalidNIS.length > 0) {
      anomalies.push({
        id: 'NIS_FORMAT',
        type: 'NIS_PATTERN',
        severity: invalidNIS.length > siswa.length * 0.1 ? 'high' : 'medium',
        title: 'Format NIS Tidak Standar',
        description: `${invalidNIS.length} siswa memiliki NIS dengan format tidak standar (bukan 8 digit).`,
        affectedItems: invalidNIS.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        suggestedAction: 'Verifikasi dan perbaiki format NIS',
        confidence: 0.95,
      });
    }

    // Check for sequential NIS patterns (possible data entry errors)
    const nisList = siswa.map(s => s.nis.replace(/\D/g, '')).sort();
    const sequentialGroups: string[][] = [];

    let currentGroup: string[] = [nisList[0]];
    for (let i = 1; i < nisList.length; i++) {
      const prev = parseInt(nisList[i - 1]);
      const curr = parseInt(nisList[i]);
      if (curr - prev === 1) {
        currentGroup.push(nisList[i]);
      } else {
        if (currentGroup.length >= 5) {
          sequentialGroups.push([...currentGroup]);
        }
        currentGroup = [nisList[i]];
      }
    }
    if (currentGroup.length >= 5) {
      sequentialGroups.push(currentGroup);
    }

    if (sequentialGroups.length > 0) {
      anomalies.push({
        id: 'NIS_SEQUENTIAL',
        type: 'NIS_PATTERN',
        severity: 'low',
        title: 'Pola NIS Berurutan Terdeteksi',
        description: `${sequentialGroups.length} grup NIS berurutan terdeteksi. Mungkin indikasi data entry otomatis atau pattern khusus.`,
        affectedItems: [],
        timestamp: new Date().toISOString(),
        confidence: 0.6,
      });
    }

    return anomalies;
  }

  /**
   * Detect inconsistent class assignments
   */
  detectClassAnomalies(siswa: StudentData[], kelas: any[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for siswa assigned to non-existent classes
    const validClassIds = new Set(kelas.map(k => k.id_kelas));
    const invalidAssignments = siswa.filter(s => !validClassIds.has(s.id_kelas));

    if (invalidAssignments.length > 0) {
      anomalies.push({
        id: 'CLASS_INVALID',
        type: 'CLASS_ASSIGNMENT',
        severity: 'high',
        title: 'Siswa Ditugaskan ke Kelas Tidak Valid',
        description: `${invalidAssignments.length} siswa ditugaskan ke kelas yang tidak ada dalam database kelas.`,
        affectedItems: invalidAssignments.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        suggestedAction: 'Perbaiki penugasan kelas atau tambahkan kelas yang hilang',
        confidence: 1.0,
      });
    }

    // Check for empty classes (classes with no students)
    const classSizes = new Map<string, number>();
    siswa.forEach(s => {
      classSizes.set(s.id_kelas, (classSizes.get(s.id_kelas) || 0) + 1);
    });

    const emptyClasses = kelas.filter(k => !classSizes.has(k.id_kelas) || classSizes.get(k.id_kelas) === 0);
    if (emptyClasses.length > 0) {
      anomalies.push({
        id: 'CLASS_EMPTY',
        type: 'CLASS_ASSIGNMENT',
        severity: 'low',
        title: 'Kelas Kosong Terdeteksi',
        description: `${emptyClasses.length} kelas tidak memiliki siswa. Pertimbangkan apakah ini diinginkan.`,
        affectedItems: emptyClasses.map(k => k.id_kelas),
        timestamp: new Date().toISOString(),
        confidence: 0.8,
      });
    }

    return anomalies;
  }

  /**
   * Detect data quality issues
   */
  detectDataQualityAnomalies(siswa: StudentData[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for empty names
    const emptyNames = siswa.filter(s => !s.nama || s.nama.trim() === '');
    if (emptyNames.length > 0) {
      anomalies.push({
        id: 'DATA_NAME_EMPTY',
        type: 'DATA_QUALITY',
        severity: 'critical',
        title: 'Data Nama Kosong',
        description: `${emptyNames.length} siswa memiliki nama kosong. Data tidak valid.`,
        affectedItems: emptyNames.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        suggestedAction: 'Lengkapi data nama siswa',
        confidence: 1.0,
      });
    }

    // Check for missing required fields
    const missingFields = siswa.filter(s => !s.id_kelas || !s.tahun_ajaran || !s.semester);
    if (missingFields.length > 0) {
      anomalies.push({
        id: 'DATA_MISSING_FIELDS',
        type: 'DATA_QUALITY',
        severity: 'high',
        title: 'Data Field Wajib Kosong',
        description: `${missingFields.length} siswa memiliki field wajib yang kosong (kelas, tahun ajaran, atau semester).`,
        affectedItems: missingFields.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        suggestedAction: 'Lengkapi data yang hilang',
        confidence: 1.0,
      });
    }

    // Check for duplicate exact records
    const seen = new Set<string>();
    const duplicates: StudentData[] = [];
    for (const s of siswa) {
      const key = `${s.nis}|${s.nama}|${s.id_kelas}`;
      if (seen.has(key)) {
        duplicates.push(s);
      } else {
        seen.add(key);
      }
    }

    if (duplicates.length > 0) {
      anomalies.push({
        id: 'DATA_DUPLICATES',
        type: 'DATA_QUALITY',
        severity: 'high',
        title: 'Data Duplikat Terdeteksi',
        description: `${duplicates.length} record duplikat persis terdeteksi. Perlu deduplikasi.`,
        affectedItems: duplicates.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        suggestedAction: 'Hapus atau merge data duplikat',
        confidence: 1.0,
      });
    }

    return anomalies;
  }

  /**
   * Detect temporal anomalies (unusual timing patterns)
   */
  detectTemporalAnomalies(siswa: StudentData[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for records created in the future
    const now = new Date();
    const futureRecords = siswa.filter(s => new Date(s.created_at) > now);

    if (futureRecords.length > 0) {
      anomalies.push({
        id: 'TEMPORAL_FUTURE',
        type: 'TEMPORAL',
        severity: 'critical',
        title: 'Data dengan Tanggal Masa Depan',
        description: `${futureRecords.length} record memiliki tanggal pembuatan di masa depan. Data tidak valid.`,
        affectedItems: futureRecords.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        suggestedAction: 'Perbaiki tanggal pembuatan data',
        confidence: 1.0,
      });
    }

    // Check for very old records (data quality issue)
    const veryOld = siswa.filter(s => {
      const age = (now.getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365);
      return age > 10; // More than 10 years old
    });

    if (veryOld.length > 0) {
      anomalies.push({
        id: 'TEMPORAL_OLD',
        type: 'TEMPORAL',
        severity: 'low',
        title: 'Data Sangat Lama Terdeteksi',
        description: `${veryOld.length} record berusia lebih dari 10 tahun. Pertimbangkan verifikasi keakuratan data.`,
        affectedItems: veryOld.map(s => s.id_siswa),
        timestamp: new Date().toISOString(),
        confidence: 0.7,
      });
    }

    return anomalies;
  }

  /**
   * Run full anomaly detection
   */
  detectAnomalies(siswa: StudentData[], kelas: any[]): AnomalyReport {
    const anomalies: Anomaly[] = [];

    anomalies.push(...this.detectEnrollmentAnomalies(siswa));
    anomalies.push(...this.detectNISAnomalies(siswa));
    anomalies.push(...this.detectClassAnomalies(siswa, kelas));
    anomalies.push(...this.detectDataQualityAnomalies(siswa));
    anomalies.push(...this.detectTemporalAnomalies(siswa));

    // Store in history
    this.anomalyHistory = [...this.anomalyHistory, ...anomalies];

    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;
    const mediumCount = anomalies.filter(a => a.severity === 'medium').length;
    const lowCount = anomalies.filter(a => a.severity === 'low').length;

    // Sort by severity
    anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const summaryParts: string[] = [];
    summaryParts.push(`Total ${anomalies.length} anomali terdeteksi.`);
    if (criticalCount > 0) summaryParts.push(`${criticalCount} kritikal.`);
    if (highCount > 0) summaryParts.push(`${highCount} tinggi.`);

    return {
      anomalies,
      summary: summaryParts.join(' '),
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Get anomaly history
   */
  getAnomalyHistory(): Anomaly[] {
    return [...this.anomalyHistory];
  }

  /**
   * Clear anomaly history
   */
  clearHistory(): void {
    this.anomalyHistory = [];
  }

  /**
   * Get quick stats
   */
  getQuickStats(report: AnomalyReport): {
    total: number;
    critical: number;
    needsAttention: number;
  } {
    return {
      total: report.anomalies.length,
      critical: report.criticalCount,
      needsAttention: report.criticalCount + report.highCount,
    };
  }
}

export const anomalyDetector = AnomalyDetector.getInstance();
export default AnomalyDetector;
