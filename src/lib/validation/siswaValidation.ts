/**
 * Siswa Validation System
 * Comprehensive validation for student data with detailed error messages
 */

export interface SiswaValidation {
  nis: string;
  nama: string;
  id_kelas: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  property?: string;
}

export class SiswaValidator {
  /**
   * Validate NIS (Nomor Induk Siswa)
   * Format: 8 digit angka, tidak ada duplikasi
   */
  static validateNIS(nis: string, allSiswa: any[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check if empty
    if (!nis || nis.trim() === '') {
      errors.push({
        field: 'nis',
        message: 'NIS tidak boleh kosong',
        code: 'REQUIRED'
      });
      return errors;
    }
    
    // Check length
    if (nis.length !== 8) {
      errors.push({
        field: 'nis',
        message: 'NIS harus 8 digit',
        code: 'INVALID_LENGTH'
      });
    }
    
    // Check if all digits
    if (!/^[0-9]{8}$/.test(nis)) {
      errors.push({
        field: 'nis',
        message: 'NIS hanya boleh mengandung angka',
        code: 'INVALID_FORMAT'
      });
    }
    
    // Check for duplicates
    const duplicate = allSiswa.find(s => s.nis === nis && s.id_siswa !== (allSiswa as any).id_siswa);
    if (duplicate) {
      errors.push({
        field: 'nis',
        message: 'NIS sudah digunakan oleh siswa lain',
        code: 'DUPLICATE'
      });
    }
    
    return errors;
  }

  /**
   * Validate nama siswa
   * Format: 3-50 karakter, tidak ada karakter spesial
   */
  static validateNama(nama: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!nama || nama.trim() === '') {
      errors.push({
        field: 'nama',
        message: 'Nama tidak boleh kosong',
        code: 'REQUIRED'
      });
      return errors;
    }
    
    if (nama.length < 3 || nama.length > 50) {
      errors.push({
        field: 'nama',
        message: 'Nama harus 3-50 karakter',
        code: 'INVALID_LENGTH'
      });
    }
    
    // Check for invalid characters
    const invalidChars = /[<>{}[\]\\/$%^&*()+=|'"`]/;
    if (invalidChars.test(nama)) {
      errors.push({
        field: 'nama',
        message: 'Nama mengandung karakter tidak valid',
        code: 'INVALID_CHARS'
      });
    }
    
    return errors;
  }

  /**
   * Validate kelas selection
   * Format: Harus ada di daftar kelas
   */
  static validateKelas(id_kelas: string, availableKelas: any[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!id_kelas) {
      errors.push({
        field: 'id_kelas',
        message: 'Kelas harus dipilih',
        code: 'REQUIRED'
      });
      return errors;
    }
    
    const kelasExists = availableKelas.some(k => k.id_kelas === id_kelas);
    if (!kelasExists) {
      errors.push({
        field: 'id_kelas',
        message: 'Kelas tidak ditemukan',
        code: 'NOT_FOUND'
      });
    }
    
    return errors;
  }

  /**
   * Complete validation for siswa data
   */
  static validateSiswaData(data: SiswaValidation, allSiswa: any[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Validate NIS
    errors.push(...this.validateNIS(data.nis, allSiswa));
    
    // Validate nama
    errors.push(...this.validateNama(data.nama));
    
    // Validate kelas
    errors.push(...this.validateKelas(data.id_kelas, allSiswa));
    
    return {
      isValid: errors.length === 0,
      errors,
      data: this.sanitizeData(data)
    };
  }

  /**
   * Sanitize input data
   */
  static sanitizeData(data: any): any {
    return {
      nis: data.nis?.toString().trim() || '',
      nama: data.nama?.toString().trim().replace(/[<>{}[\]\\/$%^&*()+=|'"`]/g, '') || '',
      id_kelas: data.id_kelas?.toString().trim() || ''
    };
  }
}
