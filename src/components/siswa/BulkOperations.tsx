/**
 * Bulk Operations Component
 * Interface for editing, deleting, and exporting multiple students at once
 */

import { useState } from 'react';
import { 
  Edit3, 
  Trash2, 
  CheckSquare, 
  X,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';

interface BulkOperationsProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
  onBulkExport: (format: 'excel' | 'pdf') => void;
  siswa: any[];
}

export default function BulkOperations({ 
  selectedIds, 
  onClearSelection, 
  onBulkDelete, 
  onBulkEdit,
  onBulkExport,
  siswa 
}: BulkOperationsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState<'delete' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedIds.size;
  const selectedSiswa = siswa.filter(s => selectedIds.has(s.id_siswa));

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      await onBulkDelete();
      setShowConfirmModal(null);
      toast.success(`${selectedCount} siswa berhasil dihapus`);
    } catch {
      toast.error('Gagal menghapus siswa');
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl p-4 flex items-center gap-4 max-w-2xl w-[calc(100%-2rem)]">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white">
              {selectedCount} Siswa Terpilih
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {selectedSiswa.filter(s => siswa.find(k => k.id_siswa === s.id_siswa)).length} data valid
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-white/[0.08]" />

        {/* Bulk Actions */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={onBulkEdit}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>

          <button
            onClick={() => onBulkExport('excel')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>

          <button
            onClick={() => setShowConfirmModal('delete')}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Hapus
          </button>

          <button
            onClick={onClearSelection}
            className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            title="Clear Selection"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmModal === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0a0e1a] rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            
            <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-2">
              Konfirmasi Penghapusan
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              Anda yakin ingin menghapus <strong className="text-slate-900 dark:text-white">{selectedCount} siswa</strong> yang dipilih?
              <br />Aksi ini tidak dapat dibatalkan.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={isProcessing}
                className="flex-1 bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ya, Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
