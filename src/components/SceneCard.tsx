import type { Scene } from '../types/scene';

interface SceneCardProps {
  scene: Scene;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export function SceneCard({ scene, isActive, onLoad, onDelete, isLoading }: SceneCardProps) {
  const sourceLabel = {
    x32: 'X32 Only',
    local: 'Local Only',
    both: 'Synced',
  }[scene.source];

  const sourceColor = {
    x32: 'badge badge-x32',
    local: 'badge badge-local',
    both: 'badge badge-both',
  }[scene.source];

  const formattedDate = new Date(scene.lastModified).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={`card relative ${isActive ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
    >
      {isActive && (
        <div className="absolute top-3 right-3 px-2 py-1 badge-active text-xs font-medium rounded-full">
          Active
        </div>
      )}

      <div className="mb-3">
        <h3 className="text-lg font-semibold pr-16">{scene.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sourceColor}`}>
            {sourceLabel}
          </span>
          <span className="text-xs">Slot {scene.index}</span>
        </div>
      </div>

      {scene.notes && (
        <p className="text-sm mb-3 line-clamp-2">{scene.notes}</p>
      )}

      <div className="text-xs empty-state mb-4">
        Last modified: {formattedDate}
      </div>

      <div className="flex gap-2">
        <button
          className="btn btn-primary flex-1"
          onClick={onLoad}
          disabled={isLoading || isActive}
        >
          {isLoading ? (
            <span className="spinner" style={{ width: '1.25rem', height: '1.25rem' }} />
          ) : isActive ? (
            'Loaded'
          ) : (
            'Load Scene'
          )}
        </button>
        <button
          className="btn btn-secondary"
          onClick={onDelete}
          disabled={isLoading}
          aria-label="Delete scene"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
