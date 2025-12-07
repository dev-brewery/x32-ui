import { useState } from 'react';
import { Modal } from './Modal';
import type { Scene } from '../types/scene';

interface CreateSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, copyFromId?: string, notes?: string) => Promise<void>;
  existingScenes: Scene[];
}

export function CreateSceneModal({
  isOpen,
  onClose,
  onCreate,
  existingScenes,
}: CreateSceneModalProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [copyFromId, setCopyFromId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Scene name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onCreate(name.trim(), copyFromId || undefined, notes.trim() || undefined);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setNotes('');
    setCopyFromId('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Scene">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="new-scene-name" className="block text-sm font-medium mb-1">
            Scene Name
          </label>
          <input
            id="new-scene-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter scene name..."
            className="input"
            maxLength={32}
            autoFocus
          />
        </div>

        <div className="mb-4">
          <label htmlFor="copy-from" className="block text-sm font-medium mb-1">
            Copy from (optional)
          </label>
          <select
            id="copy-from"
            value={copyFromId}
            onChange={e => setCopyFromId(e.target.value)}
            className="input"
          >
            <option value="">Start from current mixer state</option>
            {existingScenes.map(scene => (
              <option key={scene.id} value={scene.id}>
                {scene.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="new-scene-notes" className="block text-sm font-medium mb-1">
            Notes (optional)
          </label>
          <textarea
            id="new-scene-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about this scene..."
            className="input resize-none"
            rows={3}
            maxLength={200}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 alert-error rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
            ) : (
              'Create Scene'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
