/**
 * Academic Sync Service
 * Manages synchronization between siswa data and the academic session system.
 * Tracks sync status, resolves conflicts, and provides auto-sync scheduling.
 */

export interface SyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  recordsSynced: number;
  conflicts: SyncConflict[];
  errorMessage: string | null;
}

export interface SyncConflict {
  id: string;
  type: 'NIS_MISMATCH' | 'KELAS_MISMATCH' | 'SESSION_MISMATCH' | 'DUPLICATE';
  siswaId: string;
  siswaName: string;
  localValue: string;
  remoteValue: string;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'manual';
}

export interface SyncOptions {
  forceFullSync?: boolean;
  resolveConflictsAutomatically?: boolean;
  conflictResolutionStrategy?: 'local' | 'remote';
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  conflicts: SyncConflict[];
  errors: string[];
  duration: number;
}

class AcademicSyncService {
  private static instance: AcademicSyncService;
  private syncStatus: SyncStatus = {
    lastSyncAt: null,
    status: 'idle',
    recordsSynced: 0,
    conflicts: [],
    errorMessage: null,
  };
  private listeners: Array<(status: SyncStatus) => void> = [];

  private constructor() {}

  static getInstance(): AcademicSyncService {
    if (!AcademicSyncService.instance) {
      AcademicSyncService.instance = new AcademicSyncService();
    }
    return AcademicSyncService.instance;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  private updateStatus(partial: Partial<SyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...partial };
    this.notifyListeners();
  }

  /**
   * Synchronize siswa data with academic session
   * Ensures all siswa records are aligned with the current academic session
   */
  async syncSiswaWithSession(
    siswa: any[],
    kelas: any[],
    currentSession: { tahunAjaran: string; semester: string },
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncConflict[] = [];
    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;

    this.updateStatus({ status: 'syncing', errorMessage: null });

    try {
      if (!currentSession.tahunAjaran || !currentSession.semester) {
        throw new Error('Sesi akademik belum dikonfigurasi. Silakan atur Tahun Ajaran dan Semester di Settings.');
      }

      for (const s of siswa) {
        try {
          // Check session alignment
          if (s.tahun_ajaran !== currentSession.tahunAjaran || s.semester !== currentSession.semester) {
            if (options.dryRun) {
              conflicts.push({
                id: `SESSION_${s.id_siswa}`,
                type: 'SESSION_MISMATCH',
                siswaId: s.id_siswa,
                siswaName: s.nama,
                localValue: `${s.tahun_ajaran}/${s.semester}`,
                remoteValue: `${currentSession.tahunAjaran}/${currentSession.semester}`,
                resolved: false,
              });
              skipped++;
              continue;
            }

            // Auto-resolve: update to current session
            if (options.resolveConflictsAutomatically && options.conflictResolutionStrategy === 'remote') {
              s.tahun_ajaran = currentSession.tahunAjaran;
              s.semester = currentSession.semester;
              synced++;
            } else {
              conflicts.push({
                id: `SESSION_${s.id_siswa}`,
                type: 'SESSION_MISMATCH',
                siswaId: s.id_siswa,
                siswaName: s.nama,
                localValue: `${s.tahun_ajaran}/${s.semester}`,
                remoteValue: `${currentSession.tahunAjaran}/${currentSession.semester}`,
                resolved: false,
              });
              skipped++;
            }
            continue;
          }

          // Check kelas validity
          const kelasExists = kelas.some(k => k.id_kelas === s.id_kelas);
          if (!kelasExists) {
            conflicts.push({
              id: `KELAS_${s.id_siswa}`,
              type: 'KELAS_MISMATCH',
              siswaId: s.id_siswa,
              siswaName: s.nama,
              localValue: s.id_kelas,
              remoteValue: 'KELAS_NOT_FOUND',
              resolved: false,
            });
            skipped++;
            continue;
          }

          // Check for duplicate NIS within current session
          const duplicates = siswa.filter(
            other => other.nis === s.nis && other.id_siswa !== s.id_siswa
          );
          if (duplicates.length > 0) {
            conflicts.push({
              id: `DUP_${s.id_siswa}`,
              type: 'DUPLICATE',
              siswaId: s.id_siswa,
              siswaName: s.nama,
              localValue: s.nis,
              remoteValue: duplicates[0].id_siswa,
              resolved: false,
            });
            skipped++;
            continue;
          }

          synced++;
        } catch (err: any) {
          errors.push(`Error syncing ${s.nama}: ${err.message}`);
          skipped++;
        }
      }

      const duration = Date.now() - startTime;
      const result: SyncResult = {
        success: errors.length === 0,
        synced,
        skipped,
        conflicts,
        errors,
        duration,
      };

      this.updateStatus({
        status: conflicts.length > 0 ? 'success' : 'success',
        lastSyncAt: new Date().toISOString(),
        recordsSynced: synced,
        conflicts,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.updateStatus({
        status: 'error',
        errorMessage: error.message,
      });

      return {
        success: false,
        synced: 0,
        skipped: siswa.length,
        conflicts: [],
        errors: [error.message],
        duration,
      };
    }
  }

  /**
   * Resolve a sync conflict
   */
  resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'manual'): void {
    const conflict = this.syncStatus.conflicts.find(c => c.id === conflictId);
    if (conflict) {
      conflict.resolved = true;
      conflict.resolution = resolution;
      this.notifyListeners();
    }
  }

  /**
   * Get sync statistics
   */
  getSyncStats(siswa: any[], currentSession: { tahunAjaran: string; semester: string }): {
    total: number;
    inCurrentSession: number;
    outOfSession: number;
    sessionBreakdown: Record<string, number>;
  } {
    const total = siswa.length;
    const inCurrentSession = siswa.filter(
      s => s.tahun_ajaran === currentSession.tahunAjaran && s.semester === currentSession.semester
    ).length;
    const outOfSession = total - inCurrentSession;

    const sessionBreakdown: Record<string, number> = {};
    siswa.forEach(s => {
      const key = `${s.tahun_ajaran || 'N/A'}/${s.semester || 'N/A'}`;
      sessionBreakdown[key] = (sessionBreakdown[key] || 0) + 1;
    });

    return { total, inCurrentSession, outOfSession, sessionBreakdown };
  }

  /**
   * Reset sync status
   */
  resetStatus(): void {
    this.syncStatus = {
      lastSyncAt: null,
      status: 'idle',
      recordsSynced: 0,
      conflicts: [],
      errorMessage: null,
    };
    this.notifyListeners();
  }
}

export const academicSync = AcademicSyncService.getInstance();
export default AcademicSyncService;
