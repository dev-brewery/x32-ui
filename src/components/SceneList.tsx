import { useState } from 'react';
import type { Scene } from '../types/scene';
import { SceneCard } from './SceneCard';

interface SceneListProps {
  scenes: Scene[];
  currentSceneIndex: number | null;
  isLoading: boolean;
  onLoadScene: (sceneId: string) => Promise<void>;
  onDeleteScene: (sceneId: string) => void;
}

export function SceneList({
  scenes,
  currentSceneIndex,
  isLoading,
  onLoadScene,
  onDeleteScene,
}: SceneListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSceneId, setLoadingSceneId] = useState<string | null>(null);

  const filteredScenes = scenes.filter(scene =>
    scene.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLoadScene = async (sceneId: string) => {
    setLoadingSceneId(sceneId);
    try {
      await onLoadScene(sceneId);
    } finally {
      setLoadingSceneId(null);
    }
  };

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search scenes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 empty-state"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Scene grid */}
      {isLoading && scenes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : filteredScenes.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto empty-state-icon mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <p className="empty-state">
            {searchTerm ? 'No scenes match your search' : 'No scenes available'}
          </p>
        </div>
      ) : (
        <div className="scene-grid">
          {filteredScenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isActive={scene.index === currentSceneIndex}
              onLoad={() => handleLoadScene(scene.id)}
              onDelete={() => onDeleteScene(scene.id)}
              isLoading={loadingSceneId === scene.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
