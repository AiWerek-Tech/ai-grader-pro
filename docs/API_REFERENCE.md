# API Reference - Siswa Management System

Complete reference for all server actions, hooks, and services available in the Siswa Management module.

---

## 📚 Table of Contents

- [Server Actions](#server-actions)
- [Hooks](#hooks)
- [Services](#services)
- [Types](#types)

---

## Server Actions

### Siswa Actions (`@/lib/actions/siswa`)

#### `getSiswaAction(kelasId?: string)`
Retrieves all siswa data, optionally filtered by class.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| kelasId | string | No | Filter by specific class ID |

**Returns:**
```typescript
{ success: boolean; data?: any[]; message?: string }
```

**Example:**
```typescript
const result = await getSiswaAction();
if (result.success) {
  console.log(`${result.data.length} siswa loaded`);
}
```

---

#### `addSiswaAction(nis: string, nama: string, kelasId: string, adminId?: string)`
Adds a new siswa to the database.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| nis | string | Yes | 8-digit unique student ID |
| nama | string | Yes | Student full name |
| kelasId | string | Yes | Class ID reference |
| adminId | string | No | Admin user ID for audit trail |

**Returns:**
```typescript
{ success: boolean; message: string }
```

**Validation Rules:**
- NIS must be unique (8 digits)
- All fields required
- Duplicate NIS check

---

#### `editSiswaAction(idSiswa: string, nis: string, nama: string, kelasId: string, adminId?: string)`
Updates existing siswa data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| idSiswa | string | Yes | Student record ID |
| nis | string | Yes | New NIS value |
| nama | string | Yes | New name value |
| kelasId | string | Yes | New class ID |
| adminId | string | No | Admin user ID |

**Returns:**
```typescript
{ success: boolean; message: string }
```

---

#### `deleteSiswaAction(idSiswa: string, adminId?: string)`
Deletes a siswa record with integrity check.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| idSiswa | string | Yes | Student ID to delete |
| adminId | string | No | Admin user ID |

**Returns:**
```typescript
{ success: boolean; message: string }
```

**Security:**
- Cascading check: Students with nilai history cannot be deleted
- Audit logging enabled

---

#### `deleteSiswaBatchAction(ids: string[], adminId?: string)`
Bulk delete multiple siswa records.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| ids | string[] | Yes | Array of student IDs |
| adminId | string | No | Admin user ID |

**Returns:**
```typescript
{ success: boolean; message: string }
```

---

#### `bulkAddSiswaAction(rows: SiswaRow[], adminId?: string)`
Import multiple siswa records at once.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| rows | SiswaRow[] | Yes | Array of {nis, nama, id_kelas} |
| adminId | string | No | Admin user ID |

**Returns:**
```typescript
{ success: boolean; message: string }
```

---

#### `cleanDuplicateSiswaAction(adminId?: string)`
Removes duplicate siswa records based on NIS.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| adminId | string | No | Admin user ID |

**Returns:**
```typescript
{ success: boolean; message: string }
```

---

### Settings Actions (`@/lib/actions/settings`)

#### `getAcademicSessionAction()`
Retrieves current academic session (tahun ajaran & semester).

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    tahunAjaran: string;
    semester: string;
    kkmEksakta: number;
    kkmNonEksakta: number;
    mapelEksakta: string[];
    minConfidence: number;
    autoSync: boolean;
  };
  message?: string;
}
```

---

## Hooks

### useSiswaValidation (`@/hooks/useSiswaValidation`)

Validation hook with rate limiting for siswa data.

**Returns:**
```typescript
{
  validateSiswaData: (data: any, allSiswa: any[]) => Promise<ValidationResult>;
  validationErrors: ValidationError[];
  isValidating: boolean;
  clearErrors: () => void;
}
```

**Example:**
```typescript
const { validateSiswaData, validationErrors, isValidating } = useSiswaValidation();

const result = await validateSiswaData({ nis, nama, id_kelas }, allSiswa);
if (result.isValid) {
  // Proceed with save
}
```

---

### useAdvancedSearch (`@/hooks/useAdvancedSearch`)

Advanced filtering, sorting, and search suggestions.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| siswa | any[] | Full siswa dataset |
| kelas | any[] | Class reference data |
| filters | SearchFilters | Filter configuration |

**Returns:**
```typescript
{
  filteredSiswa: any[];
  isSearching: boolean;
  searchSuggestions: string[];
  filterStats: FilterStats;
}
```

**Filter Options:**
```typescript
{
  searchTerm: string;
  id_kelas: string;
  jenjang: string;
  sortBy: 'nama' | 'nis' | 'kelas' | 'created';
  sortOrder: 'asc' | 'desc';
}
```

---

### useKeyboardShortcuts (`@/hooks/useKeyboardShortcuts`)

Global keyboard shortcut management.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| shortcuts | ShortcutDefinition[] | Array of shortcut definitions |

**Returns:**
```typescript
{
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  getGroupedShortcuts: () => ShortcutGroup[];
}
```

**Default Shortcuts:**
| Key | Action |
|-----|--------|
| Ctrl+K | Focus search |
| Ctrl+N | Add new siswa |
| Ctrl+I | Import siswa |
| Ctrl+E | Export data |
| Ctrl+R | Refresh data |
| Ctrl+/ | Show shortcuts help |
| Escape | Close modal |

---

### useSystemHealth (`@/hooks/useSystemHealth`)

System health monitoring with periodic checks.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| checkConfigs | HealthCheckConfig[] | Health check configurations |

**Returns:**
```typescript
{
  health: SystemHealth;
  isMonitoring: boolean;
  startMonitoring: (intervalMs?: number) => void;
  stopMonitoring: () => void;
  runAllChecks: () => Promise<void>;
  getHealthSummary: () => string;
}
```

**Health States:**
- `healthy`: Score >= 80%
- `degraded`: Score 50-79%
- `down`: Score < 50%

---

## Services

### academicSync (`@/lib/integration/academicSync`)

Academic session synchronization service.

**Methods:**

#### `syncSiswaWithSession(siswa, kelas, session, options?)`
Syncs siswa data with current academic session.

**Options:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| forceFullSync | boolean | false | Force complete resync |
| resolveConflictsAutomatically | boolean | false | Auto-resolve conflicts |
| conflictResolutionStrategy | 'local' \| 'remote' | 'local' | Which value wins |
| dryRun | boolean | false | Preview without applying |

**Returns:** `Promise<SyncResult>`

#### `getStatus()`
Returns current sync status.

#### `subscribe(listener)`
Subscribe to sync status changes.

---

### notificationService (`@/lib/notifications/notificationService`)

Centralized notification management.

**Methods:**

| Method | Description |
|--------|-------------|
| `info(title, message, options?)` | Info notification |
| `success(title, message, options?)` | Success notification |
| `warning(title, message, options?)` | Warning notification |
| `error(title, message, options?)` | Error notification |
| `system(title, message, options?)` | System notification |
| `dismiss(id)` | Dismiss specific notification |
| `dismissAll()` | Dismiss all notifications |
| `getActive()` | Get active notifications |
| `getCount()` | Get notification counts |

**Priority Levels:**
- `low` - Background info
- `medium` - Standard notifications
- `high` - Important alerts
- `critical` - Immediate attention required

---

### dataBackup (`@/lib/services/dataBackup`)

Data backup and restore service.

**Methods:**

#### `createBackup(data)`
Creates a full backup as Excel file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| data | Record<string, any[]> | Object with sheet names as keys |

**Returns:** `BackupResult`

#### `restoreFromFile(file)`
Restores data from backup file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| file | File | Backup Excel file |

**Returns:** `Promise<RestoreResult>`

#### `verifyIntegrity(data, checksum)`
Verifies data integrity against checksum.

---

### SiswaExportService (`@/lib/services/siswaExport`)

Professional export service for PDF and Excel.

**Methods:**

#### `exportToExcel(data, options?)`
Export to formatted Excel file.

**Data Structure:**
```typescript
{
  siswa: any[];
  kelas: any[];
  title?: string;
  subtitle?: string;
}
```

**Options:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| filename | string | 'data-siswa' | Output filename |
| includeTimestamp | boolean | true | Add timestamp to filename |

---

## Types

### Validation Types

```typescript
interface ValidationError {
  field: string;
  message: string;
  code: 'REQUIRED' | 'INVALID_LENGTH' | 'INVALID_FORMAT' | 'DUPLICATE' | 'SYSTEM_ERROR';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
```

### Sync Types

```typescript
interface SyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  recordsSynced: number;
  conflicts: SyncConflict[];
  errorMessage: string | null;
}

interface SyncConflict {
  id: string;
  type: 'NIS_MISMATCH' | 'KELAS_MISMATCH' | 'SESSION_MISMATCH' | 'DUPLICATE';
  siswaId: string;
  siswaName: string;
  localValue: string;
  remoteValue: string;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'manual';
}
```

### Health Types

```typescript
interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: string;
  message: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  score: number;
  checks: HealthCheck[];
  uptime: number;
  errorRate: number;
  memoryUsage: number;
  lastUpdated: string;
}
```

---

## Error Handling

All server actions return a standardized error format:

```typescript
{
  success: false;
  message: string; // User-friendly error message
}
```

**Common Error Codes:**
| Code | Description |
|------|-------------|
| DUPLICATE | NIS already exists |
| REQUIRED | Missing required field |
| INVALID_FORMAT | Invalid data format |
| HAS_HISTORY | Cannot delete - has grade history |
| RATE_LIMIT | Too many validation attempts |

---

## Usage Examples

### Complete Workflow

```typescript
// 1. Fetch data
const siswa = await getSiswaAction();

// 2. Validate before save
const validation = await validateSiswaData(newData, siswa.data);
if (!validation.isValid) {
  // Show errors
  return;
}

// 3. Save data
const result = await addSiswaAction(nis, nama, kelasId);
if (result.success) {
  notificationService.success('Siswa', result.message);
}

// 4. Sync with academic session
await academicSync.syncSiswaWithSession(siswa.data, kelas, session);

// 5. Create backup
dataBackup.createBackup({ SISWA: siswa.data, KELAS: kelas });
```

---

## Support

For issues or feature requests, refer to the implementation documentation:
- `implementations/IMPLEMENTATION_ROADMAP.md`
- `implementations/PHASE4_PLAN.md`
- `docs/SISWA_FEATURES.md`
