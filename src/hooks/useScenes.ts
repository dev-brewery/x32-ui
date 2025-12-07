import { useState, useEffect, useCallback } from 'react';
import type { Scene, ConnectionStatus } from '../types/scene';

interface UseScenesReturn {
  scenes: Scene[];
  currentSceneIndex: number | null;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  error: string | null;
  loadScene: (sceneId: string) => Promise<void>;
  saveScene: (name: string, notes?: string) => Promise<void>;
  createScene: (name: string, copyFromId?: string, notes?: string) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  refreshScenes: () => Promise<void>;
}

export function useScenes(): UseScenesReturn {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('mock');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch scenes from API
  const fetchScenes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scenes');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load scenes');
      }

      setScenes(data.data.scenes);
      setCurrentSceneIndex(data.data.currentSceneIndex ?? null);
      setConnectionStatus(data.data.connectionStatus as ConnectionStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  const loadScene = useCallback(async (sceneId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/scenes/${sceneId}/load`, { method: 'POST' });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load scene');
      }

      const scene = scenes.find(s => s.id === sceneId);
      if (scene) {
        setCurrentSceneIndex(scene.index);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scene');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [scenes]);

  const saveScene = useCallback(async (name: string, notes?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, notes }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save scene');
      }

      // Refresh scenes list after save
      await fetchScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scene');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchScenes]);

  const createScene = useCallback(async (name: string, copyFromId?: string, notes?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, copyFromId, notes }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create scene');
      }

      // Refresh scenes list after create
      await fetchScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchScenes]);

  const deleteScene = useCallback(async (sceneId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/scenes/${sceneId}`, { method: 'DELETE' });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete scene');
      }

      // Refresh scenes list after delete
      await fetchScenes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scene');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchScenes]);

  const refreshScenes = useCallback(async () => {
    await fetchScenes();
  }, [fetchScenes]);

  return {
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
  };
}
