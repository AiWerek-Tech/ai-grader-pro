/**
 * Validation Errors Component
 * Displays validation errors with user-friendly messages
 */

import { AlertCircle, X } from 'lucide-react';
import { ValidationError } from '@/lib/validation/siswaValidation';

interface ValidationErrorsProps {
  errors: ValidationError[];
  onClear?: () => void;
}

export default function ValidationErrors({ errors, onClear }: ValidationErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            Validasi Data Gagal
          </h3>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <ul className="mt-3 space-y-2">
        {errors.map((error, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <span className="text-red-600 dark:text-red-300">
              • {error.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
