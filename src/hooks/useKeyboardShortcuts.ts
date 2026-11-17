/**
 * Keyboard Shortcuts Hook
 * Global keyboard shortcut management with customizable bindings,
 * context-aware shortcuts, and a help overlay.
 */

'use client';

import { useEffect, useCallback, useState } from 'react';

export interface ShortcutDefinition {
  key: string; // e.g., 'ctrl+k', 'ctrl+shift+f', 'escape'
  description: string;
  category: string;
  action: () => void;
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface ShortcutGroup {
  category: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const MODIFIER_MAP: Record<string, string[]> = {
  ctrl: ['Control', 'Ctrl'],
  shift: ['Shift'],
  alt: ['Alt', 'AltGraph'],
  meta: ['Meta', 'Command'],
};

function parseShortcut(shortcut: string): {
  modifiers: Set<string>;
  key: string;
} {
  const parts = shortcut.toLowerCase().split('+').map(p => p.trim());
  const modifiers = new Set<string>();
  let key = '';

  for (const part of parts) {
    if (MODIFIER_MAP[part]) {
      modifiers.add(part);
    } else {
      key = part;
    }
  }

  return { modifiers, key };
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const { modifiers, key } = parseShortcut(shortcut);

  const ctrlRequired = modifiers.has('ctrl');
  const shiftRequired = modifiers.has('shift');
  const altRequired = modifiers.has('alt');
  const metaRequired = modifiers.has('meta');

  if (ctrlRequired !== (event.ctrlKey || event.metaKey)) return false;
  if (shiftRequired !== event.shiftKey) return false;
  if (altRequired !== event.altKey) return false;
  if (metaRequired !== event.metaKey) return false;

  const eventKey = event.key.toLowerCase();
  return eventKey === key;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Help overlay toggle: Ctrl+/
      if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      // Escape closes help
      if (event.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }

      // Check registered shortcuts
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        if (matchesShortcut(event, shortcut.key)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, showHelp]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Get grouped shortcuts for help display
   */
  const getGroupedShortcuts = useCallback((): ShortcutGroup[] => {
    const groups: Record<string, ShortcutGroup> = {};

    // Add help shortcut
    groups['General'] = {
      category: 'General',
      shortcuts: [{ key: 'Ctrl+/', description: 'Tampilkan bantuan shortcut' }],
    };

    for (const s of shortcuts) {
      if (!groups[s.category]) {
        groups[s.category] = { category: s.category, shortcuts: [] };
      }
      groups[s.category].shortcuts.push({
        key: s.key.toUpperCase(),
        description: s.description,
      });
    }

    return Object.values(groups);
  }, [shortcuts]);

  return {
    showHelp,
    setShowHelp,
    getGroupedShortcuts,
  };
}

/**
 * Default siswa page shortcuts factory
 */
export function createSiswaShortcuts(actions: {
  onSearch?: () => void;
  onAdd?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  onToggleAnalytics?: () => void;
  onToggleAI?: () => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onCloseModal?: () => void;
}): ShortcutDefinition[] {
  return [
    {
      key: 'ctrl+k',
      description: 'Buka pencarian',
      category: 'Navigasi',
      action: () => actions.onSearch?.(),
    },
    {
      key: 'ctrl+n',
      description: 'Tambah siswa baru',
      category: 'Aksi',
      action: () => actions.onAdd?.(),
    },
    {
      key: 'ctrl+i',
      description: 'Import data siswa',
      category: 'Aksi',
      action: () => actions.onImport?.(),
    },
    {
      key: 'ctrl+e',
      description: 'Export data siswa',
      category: 'Aksi',
      action: () => actions.onExport?.(),
    },
    {
      key: 'ctrl+r',
      description: 'Refresh data',
      category: 'Aksi',
      action: () => actions.onRefresh?.(),
    },
    {
      key: 'ctrl+shift+a',
      description: 'Toggle analytics',
      category: 'Tampilan',
      action: () => actions.onToggleAnalytics?.(),
    },
    {
      key: 'ctrl+shift+i',
      description: 'Toggle AI Dashboard',
      category: 'Tampilan',
      action: () => actions.onToggleAI?.(),
    },
    {
      key: 'ctrl+shift+s',
      description: 'Pilih semua siswa',
      category: 'Seleksi',
      action: () => actions.onSelectAll?.(),
    },
    {
      key: 'ctrl+d',
      description: 'Hapus seleksi',
      category: 'Seleksi',
      action: () => actions.onClearSelection?.(),
    },
    {
      key: 'escape',
      description: 'Tutup modal / Batal',
      category: 'Navigasi',
      action: () => actions.onCloseModal?.(),
    },
  ];
}
