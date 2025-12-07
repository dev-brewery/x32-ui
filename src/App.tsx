import { useState, useCallback } from 'react';
import { useScenes } from './hooks/useScenes';
import { useToast, ToastContainer } from './components/Toast';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SceneList } from './components/SceneList';
import { SaveSceneModal } from './components/SaveSceneModal';
import { CreateSceneModal } from './components/CreateSceneModal';
import { ConfirmModal } from './components/ConfirmModal';
import { BackupModal } from './components/BackupModal';

function App() {
  const {
    scenes,
    currentSceneIndex,
    connectionStatus,
    isLoading,
    error,
    loadScene,
    saveScene,
    createScene,
    deleteScene,
    refreshScenes,
  } = useScenes();

  const { toasts, addToast, removeToast } = useToast();

  // Modal states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [deleteConfirmScene, setDeleteConfirmScene] = useState<string | null>(null);
  const [loadConfirmScene, setLoadConfirmScene] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Handle scene load with confirmation
  const handleLoadScene = async (sceneId: string) => {
    setLoadConfirmScene(sceneId);
  };

  const confirmLoadScene = async () => {
    if (!loadConfirmScene) return;

    try {
      await loadScene(loadConfirmScene);
      const scene = scenes.find(s => s.id === loadConfirmScene);
      addToast(`Scene "${scene?.name}" loaded successfully`, 'success');
    } catch {
      addToast('Failed to load scene', 'error');
    } finally {
      setLoadConfirmScene(null);
    }
  };

  // Handle save
  const handleSaveScene = async (name: string, notes?: string) => {
    try {
      await saveScene(name, notes);
      addToast(`Scene "${name}" saved successfully`, 'success');
    } catch {
      addToast('Failed to save scene', 'error');
      throw new Error('Failed to save scene');
    }
  };

  // Handle create
  const handleCreateScene = async (name: string, copyFromId?: string, notes?: string) => {
    try {
      await createScene(name, copyFromId, notes);
      addToast(`Scene "${name}" created successfully`, 'success');
    } catch {
      addToast('Failed to create scene', 'error');
      throw new Error('Failed to create scene');
    }
  };

  // Handle delete with confirmation
  const handleDeleteScene = (sceneId: string) => {
    setDeleteConfirmScene(sceneId);
  };

  const confirmDeleteScene = async () => {
    if (!deleteConfirmScene) return;

    try {
      const scene = scenes.find(s => s.id === deleteConfirmScene);
      await deleteScene(deleteConfirmScene);
      addToast(`Scene "${scene?.name}" deleted`, 'info');
    } catch {
      addToast('Failed to delete scene', 'error');
    } finally {
      setDeleteConfirmScene(null);
    }
  };

  // Handle backup completion
  const handleBackupComplete = (filename: string) => {
    addToast(`Backup created: ${filename}`, 'success');
  };

  // Handle full console.bak backup with download (matches X32 Setup > Backup)
  const handleFullBackup = useCallback(async () => {
    if (isBackingUp) return;

    setIsBackingUp(true);
    addToast('Creating full console backup... This may take 2-3 minutes.', 'info');

    try {
      const response = await fetch('/api/backup/console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create backup');
      }

      // Download the created backup file
      const downloadLink = document.createElement('a');
      downloadLink.href = `/api/backup/${data.data.filename}`;
      downloadLink.download = data.data.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      addToast(
        `Console backup downloaded: ${data.data.filename} (${data.data.parameterCount} params, ${data.data.sceneCount} scenes)`,
        'success'
      );
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to create backup', 'error');
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp, addToast]);

  const sceneToDelete = scenes.find(s => s.id === deleteConfirmScene);
  const sceneToLoad = scenes.find(s => s.id === loadConfirmScene);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">
                X32 Scene Manager
              </h1>
              <ConnectionStatus status={connectionStatus} />
            </div>

            <div className="flex items-center gap-3">
              <button
                className="btn btn-secondary"
                onClick={refreshScenes}
                disabled={isLoading}
                title="Refresh scenes"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                className="btn btn-success"
                onClick={() => setIsSaveModalOpen(true)}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 alert-error rounded-lg">
            {error}
          </div>
        )}

        <SceneList
          scenes={scenes}
          currentSceneIndex={currentSceneIndex}
          isLoading={isLoading}
          onLoadScene={handleLoadScene}
          onDeleteScene={handleDeleteScene}
        />
      </main>

      {/* Floating Backup Buttons - Bottom Right */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-30">
        {/* Full Console Backup Button - Creates console.bak matching X32's Setup > Backup */}
        <button
          className="btn bg-green-700 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleFullBackup}
          disabled={isBackingUp}
          title="Full console backup (.bak) - Restore via Setup > Global > Restore"
        >
          {isBackingUp ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
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
              Backing up...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Full Backup
            </>
          )}
        </button>

        {/* Manage Backups Button - Opens modal */}
        <button
          className="btn btn-secondary shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2"
          onClick={() => setIsBackupModalOpen(true)}
          title="Manage all backups"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          Manage
        </button>
      </div>

      {/* Modals */}
      <SaveSceneModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveScene}
      />

      <CreateSceneModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateScene}
        existingScenes={scenes}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onBackupComplete={handleBackupComplete}
      />

      <ConfirmModal
        isOpen={loadConfirmScene !== null}
        onClose={() => setLoadConfirmScene(null)}
        onConfirm={confirmLoadScene}
        title="Load Scene"
        message={`Are you sure you want to load "${sceneToLoad?.name}"? This will change the current mixer configuration.`}
        confirmLabel="Load Scene"
        variant="primary"
      />

      <ConfirmModal
        isOpen={deleteConfirmScene !== null}
        onClose={() => setDeleteConfirmScene(null)}
        onConfirm={confirmDeleteScene}
        title="Delete Scene"
        message={`Are you sure you want to delete "${sceneToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default App;
