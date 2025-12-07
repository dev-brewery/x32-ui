import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useBackup, type BackupInfo } from '../hooks/useBackup';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupComplete?: (filename: string) => void;
}

export function BackupModal({ isOpen, onClose, onBackupComplete }: BackupModalProps) {
  const {
    backups,
    isLoading,
    isCreating,
    isCreatingFull,
    error,
    createBackup,
    createFullBackup,
    fetchBackups,
    deleteBackup,
    downloadBackup,
  } = useBackup();

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen, fetchBackups]);

  const handleCreateQuickBackup = async () => {
    try {
      const result = await createBackup();
      onBackupComplete?.(result.filename);
    } catch {
      // Error already handled by hook
    }
  };

  const handleCreateFullBackup = async () => {
    try {
      const result = await createFullBackup();
      onBackupComplete?.(result.filename);
    } catch {
      // Error already handled by hook
    }
  };

  const handleDelete = async (filename: string) => {
    if (deleteConfirm === filename) {
      try {
        await deleteBackup(filename);
        setDeleteConfirm(null);
      } catch {
        // Error already handled by hook
      }
    } else {
      setDeleteConfirm(filename);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatBadge = (format: 'json' | 'scn' | 'bak') => {
    if (format === 'bak') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-200">
          Full
        </span>
      );
    }
    if (format === 'scn') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-200">
          Scene
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
        Meta
      </span>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="X32 Backup Manager">
      <div className="space-y-6">
        {/* Create Backup Section */}
        <div className="space-y-4">
          {/* Scene Backup (.scn) */}
          <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-100 mb-2">
              Scene Backup (.scn)
            </h3>
            <p className="text-blue-200/70 text-sm mb-4">
              Captures current mixer state as a single scene (~2000+ params).
              Restore via <strong>Scenes {'>'} Utility {'>'} Import</strong>.
            </p>

            <button
              className="btn bg-blue-700 hover:bg-blue-600 text-white w-full flex items-center justify-center gap-2"
              onClick={handleCreateFullBackup}
              disabled={isCreatingFull || isCreating}
            >
              {isCreatingFull ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating Scene Backup...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Create Scene Backup
                </>
              )}
            </button>
          </div>

          {/* Quick Metadata Backup */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">Quick Scene List Backup (.json)</h3>
            <p className="text-gray-400 text-sm mb-4">
              Quick backup of scene names, notes, and indices. Useful for keeping
              track of your scene organization.
            </p>

            <button
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
              onClick={handleCreateQuickBackup}
              disabled={isCreating || isCreatingFull}
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Quick Scene List Backup
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 alert-error rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Previous Backups Section */}
        <div>
          <h3 className="text-lg font-medium mb-3">Previous Backups</h3>

          {isLoading ? (
            <div className="text-center py-8 text-gray-400">
              Loading backups...
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No backups yet. Create your first backup above.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {backups.map((backup: BackupInfo) => (
                <div
                  key={backup.filename}
                  className="bg-gray-800 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{backup.consoleName}</span>
                        {getFormatBadge(backup.format)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatDate(backup.timestamp)}
                        {backup.format === 'scn' && backup.parameterCount && (
                          <> · {backup.parameterCount.toLocaleString()} params</>
                        )}
                        {backup.format === 'json' && backup.scenesCount && (
                          <> · {backup.scenesCount} scenes</>
                        )}
                        {' · '}{formatSize(backup.size)}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => downloadBackup(backup.filename)}
                        className="btn btn-secondary text-sm py-1 px-3"
                        title="Download backup"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(backup.filename)}
                        className={`btn text-sm py-1 px-3 ${
                          deleteConfirm === backup.filename
                            ? 'btn-danger'
                            : 'btn-secondary hover:bg-red-900/50'
                        }`}
                        title={deleteConfirm === backup.filename ? 'Click again to confirm' : 'Delete backup'}
                      >
                        {deleteConfirm === backup.filename ? (
                          'Confirm?'
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* USB Instructions */}
        <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3 space-y-3">
          <div>
            <strong className="text-green-400">Full Backup (.bak) - Complete Console Restore:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Format USB as FAT32, copy .bak file to root</li>
              <li>On X32: <strong>Setup {'>'} Global {'>'} Restore</strong></li>
              <li>Select the .bak file - restores EVERYTHING</li>
            </ol>
          </div>
          <div>
            <strong className="text-blue-400">Scene Backup (.scn) - Single Scene Import:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Format USB as FAT32, copy .scn file to root</li>
              <li>On X32: <strong>Scenes {'>'} Utility {'>'} Import</strong></li>
              <li>Imports as one scene - recall to apply</li>
            </ol>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-gray-700">
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
