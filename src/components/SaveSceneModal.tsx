import { useState } from 'react';
import { Modal } from './Modal';

interface SaveSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, notes?: string) => Promise<void>;
}

export function SaveSceneModal({ isOpen, onClose, onSave }: SaveSceneModalProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
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
      await onSave(name.trim(), notes.trim() || undefined);
      setName('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scene');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Save Current Scene">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="scene-name" className="block text-sm font-medium mb-1">
            Scene Name
          </label>
          <input
            id="scene-name"
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
          <label htmlFor="scene-notes" className="block text-sm font-medium mb-1">
            Notes (optional)
          </label>
          <textarea
            id="scene-notes"
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
          <button type="submit" className="btn btn-success" disabled={isLoading}>
            {isLoading ? (
              <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
            ) : (
              'Save Scene'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
