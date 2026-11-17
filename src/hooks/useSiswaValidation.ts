/**
 * Custom hook for siswa validation
 * Integrates with validation system and provides user-friendly error messages
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { SiswaValidator, ValidationError } from '@/lib/validation/siswaValidation';
import RateLimiter from '@/lib/security/rateLimiter';

// Module-level limiter for siswa validation (client-side)
const siswaValidationLimiter = new RateLimiter({ windowMs: 60 * 1000, maxAttempts: 10 });

export const useSiswaValidation = () => {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateSiswaData = useCallback(async (data: any, allSiswa: any[]) => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      // Check rate limit first
      if (!siswaValidationLimiter.checkLimit('siswa_validation')) {
        toast.error('Terlalu banyak percobaan validasi. Silakan coba lagi dalam 1 menit.');
        return { isValid: false, errors: [{ field: 'global', message: 'Rate limit exceeded' }] };
      }

      const result = SiswaValidator.validateSiswaData(data, allSiswa);
      
      if (result.isValid) {
        toast.success('Data siswa valid!');
        setValidationErrors([]);
      } else {
        toast.error('Data siswa tidak valid. Silakan periksa kembali.');
        setValidationErrors(result.errors);
      }
    } catch {
      toast.error('Terjadi kesalahan saat validasi data');
      setValidationErrors([{ field: 'global', message: 'Validation system error', code: 'SYSTEM_ERROR' }]);
    } finally {
      setIsValidating(false);
    }

    return {
      validationErrors,
      isValidating,
      clearErrors: () => setValidationErrors([])
    };
  }, []);

  return { validateSiswaData, validationErrors, isValidating };
};
