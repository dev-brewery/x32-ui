import { useState, useCallback } from 'react';

export interface BackupInfo {
  filename: string;
  timestamp: string;
  consoleName: string;
  scenesCount?: number;
  parameterCount?: number;
  size: number;
  format: 'json' | 'scn' | 'bak';
  restoreMethod?: string;
}

export interface BackupResult {
  filename: string;
  timestamp: string;
  scenesBackedUp?: number;
  consoleName: string;
  format?: 'json' | 'scn';
}

export interface FullBackupResult {
  filename: string;
  timestamp: string;
  consoleName: string;
  consoleModel: string;
  firmware: string;
  parameterCount: number;
  duration: number;
  format: 'scn';
  usbCompatible: boolean;
}

export interface LoadBackupResult {
  filename: string;
  parameterCount: number;
  duration: number;
  errors: number;
}

interface UseBackupReturn {
  backups: BackupInfo[];
  isLoading: boolean;
  isCreating: boolean;
  isCreatingFull: boolean;
  isLoadingBackup: boolean;
  error: string | null;
  createBackup: () => Promise<BackupResult>;
  createFullBackup: (sceneName?: string, notes?: string) => Promise<FullBackupResult>;
  loadBackup: (filename: string) => Promise<LoadBackupResult>;
  fetchBackups: () => Promise<void>;
  deleteBackup: (filename: string) => Promise<void>;
  downloadBackup: (filename: string) => void;
}

export function useBackup(): UseBackupReturn {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFull, setIsCreatingFull] = useState(false);
  const [isLoadingBackup, setIsLoadingBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backup');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch backups');
      }

      setBackups(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch backups');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBackup = useCallback(async (): Promise<BackupResult> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create backup');
      }

      // Refresh the backup list
      await fetchBackups();

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create backup';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [fetchBackups]);

  const createFullBackup = useCallback(async (
    sceneName: string = 'Full-Backup',
    notes: string = ''
  ): Promise<FullBackupResult> => {
    setIsCreatingFull(true);
    setError(null);

    try {
      const response = await fetch('/api/backup/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sceneName, notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create full backup');
      }

      // Refresh the backup list
      await fetchBackups();

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create full backup';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCreatingFull(false);
    }
  }, [fetchBackups]);

  const loadBackup = useCallback(async (filename: string): Promise<LoadBackupResult> => {
    setIsLoadingBackup(true);
    setError(null);

    try {
      const response = await fetch(`/api/backup/${filename}/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load backup');
      }

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load backup';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoadingBackup(false);
    }
  }, []);

  const deleteBackup = useCallback(async (filename: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/backup/${filename}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete backup');
      }

      // Refresh the backup list
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBackups]);

  const downloadBackup = useCallback((filename: string) => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = `/api/backup/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    backups,
    isLoading,
    isCreating,
    isCreatingFull,
    isLoadingBackup,
    error,
    createBackup,
    createFullBackup,
    loadBackup,
    fetchBackups,
    deleteBackup,
    downloadBackup,
  };
}
