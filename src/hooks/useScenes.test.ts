import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScenes } from './useScenes';
import {
  setupFetchFallback,
  teardownFetchFallback,
  resetMockState,
  getCurrentFetchMode,
} from '../test/fetch-fallback';

describe('useScenes', () => {
  beforeEach(() => {
    resetMockState();
    setupFetchFallback();
  });

  afterEach(() => {
    teardownFetchFallback();
  });

  describe('Initialization', () => {
    it('returns initial loading state', () => {
      const { result } = renderHook(() => useScenes());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.scenes).toEqual([]);
      expect(result.current.currentSceneIndex).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('loads scenes after initialization', async () => {
      const { result } = renderHook(() => useScenes());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.scenes.length).toBeGreaterThan(0);
      expect(result.current.currentSceneIndex).toBe(0);

      // Log which fetch mode was used
      console.log(`[Test] Fetch mode: ${getCurrentFetchMode()}`);
    });

    it('sets initial scenes with correct data structure', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstScene = result.current.scenes[0];
      expect(firstScene).toHaveProperty('id');
      expect(firstScene).toHaveProperty('name');
      expect(firstScene).toHaveProperty('index');
      expect(firstScene).toHaveProperty('source');
      expect(firstScene).toHaveProperty('lastModified');
      expect(firstScene).toHaveProperty('hasLocalBackup');
    });
  });

  describe('loadScene', () => {
    it('updates currentSceneIndex when loading a scene', async () => {
      const { result } = renderHook(() => useScenes());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Load scene with id '2' (index 1)
      await act(async () => {
        await result.current.loadScene('2');
      });

      expect(result.current.currentSceneIndex).toBe(1);
    });

    it('handles non-existent scene gracefully', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const originalIndex = result.current.currentSceneIndex;

      // Loading non-existent scene should throw/fail
      await act(async () => {
        try {
          await result.current.loadScene('nonexistent');
        } catch {
          // Expected to fail
        }
      });

      // currentSceneIndex should remain unchanged for nonexistent scene
      expect(result.current.currentSceneIndex).toBe(originalIndex);
    });
  });

  describe('saveScene', () => {
    it('adds new scene to the list', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = result.current.scenes.length;

      await act(async () => {
        await result.current.saveScene('New Scene', 'Test notes');
      });

      await waitFor(() => {
        expect(result.current.scenes.length).toBe(initialCount + 1);
      });

      const newScene = result.current.scenes[result.current.scenes.length - 1];
      expect(newScene.name).toBe('New Scene');
      expect(newScene.notes).toBe('Test notes');
    });

    it('creates scene without notes', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveScene('No Notes Scene');
      });

      await waitFor(() => {
        expect(result.current.scenes.some(s => s.name === 'No Notes Scene')).toBe(true);
      });

      const newScene = result.current.scenes.find(s => s.name === 'No Notes Scene');
      expect(newScene?.name).toBe('No Notes Scene');
      expect(newScene?.notes).toBeUndefined();
    });
  });

  describe('createScene', () => {
    it('creates a new scene', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = result.current.scenes.length;

      await act(async () => {
        await result.current.createScene('Created Scene', undefined, 'Created notes');
      });

      await waitFor(() => {
        expect(result.current.scenes.length).toBe(initialCount + 1);
      });

      const newScene = result.current.scenes[result.current.scenes.length - 1];
      expect(newScene.name).toBe('Created Scene');
      expect(newScene.source).toBe('local');
    });

    it('copies notes from source scene when copyFromId is provided', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Copy from scene '1' which has notes
      await act(async () => {
        await result.current.createScene('Copied Scene', '1');
      });

      await waitFor(() => {
        expect(result.current.scenes.some(s => s.name === 'Copied Scene')).toBe(true);
      });

      const newScene = result.current.scenes.find(s => s.name === 'Copied Scene');
      expect(newScene?.name).toBe('Copied Scene');
      // Notes should be copied from source
      expect(newScene?.notes).toBeDefined();
    });
  });

  describe('deleteScene', () => {
    it('removes scene from the list', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = result.current.scenes.length;
      const sceneToDelete = result.current.scenes[0];

      await act(async () => {
        await result.current.deleteScene(sceneToDelete.id);
      });

      await waitFor(() => {
        expect(result.current.scenes.length).toBe(initialCount - 1);
      });

      expect(result.current.scenes.find(s => s.id === sceneToDelete.id)).toBeUndefined();
    });
  });

  describe('refreshScenes', () => {
    it('reloads scenes', async () => {
      const { result } = renderHook(() => useScenes());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const sceneCount = result.current.scenes.length;

      await act(async () => {
        await result.current.refreshScenes();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.scenes.length).toBe(sceneCount);
    });
  });

  describe('Error Handling', () => {
    it('initializes with no error', () => {
      const { result } = renderHook(() => useScenes());
      expect(result.current.error).toBeNull();
    });
  });
});
