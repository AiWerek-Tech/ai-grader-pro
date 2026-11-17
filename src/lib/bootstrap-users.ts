type BootstrapRole = 'ADMIN' | 'GURU';

export interface BootstrapUser {
  username: string;
  password: string;
  role: BootstrapRole;
  nama: string;
}

const DEV_BOOTSTRAP_USERS: BootstrapUser[] = [
  { username: 'admin', password: 'admin123', role: 'ADMIN', nama: 'Administrator' },
  { username: 'guru1', password: 'guru123', role: 'GURU', nama: 'Guru Matematika' },
  { username: 'guru2', password: 'guru123', role: 'GURU', nama: 'Guru B. Indonesia' },
  { username: 'guru3', password: 'guru123', role: 'GURU', nama: 'Guru IPA' },
];

function getProductionBootstrapAdmin(): BootstrapUser {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const nama = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrator';

  if (!username || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_USERNAME dan BOOTSTRAP_ADMIN_PASSWORD wajib diisi untuk bootstrap production.'
    );
  }

  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD minimal 12 karakter untuk production.');
  }

  return { username, password, role: 'ADMIN', nama };
}

export function getBootstrapUsers(): BootstrapUser[] {
  if (process.env.NODE_ENV === 'production') {
    return [getProductionBootstrapAdmin()];
  }

  return DEV_BOOTSTRAP_USERS;
}

export function getBootstrapMode() {
  return process.env.NODE_ENV === 'production' ? 'env-admin' : 'dev-defaults';
}
