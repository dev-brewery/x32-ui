import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenes } from './useScenes';

describe('useScenes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('returns initial loading state', () => {
      const { result } = renderHook(() => useScenes());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.scenes).toEqual([]);
      expect(result.current.currentSceneIndex).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('loads mock scenes after initialization', async () => {
      const { result } = renderHook(() => useScenes());

      expect(result.current.isLoading).toBe(true);

      // Advance timers to complete the mock fetch (500ms delay)
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.scenes.length).toBeGreaterThan(0);
      expect(result.current.currentSceneIndex).toBe(0);
      expect(result.current.connectionStatus).toBe('mock');
    });

    it('sets initial scenes with correct data structure', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
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
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Load scene with id '2' (index 1)
      await act(async () => {
        result.current.loadScene('2');
        vi.advanceTimersByTime(900);
      });

      expect(result.current.currentSceneIndex).toBe(1);
    });

    it('handles non-existent scene gracefully', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      const originalIndex = result.current.currentSceneIndex;

      await act(async () => {
        result.current.loadScene('nonexistent');
        vi.advanceTimersByTime(900);
      });

      // currentSceneIndex should remain unchanged for nonexistent scene
      expect(result.current.currentSceneIndex).toBe(originalIndex);
    });
  });

  describe('saveScene', () => {
    it('adds new scene to the list', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      const initialCount = result.current.scenes.length;

      await act(async () => {
        result.current.saveScene('New Scene', 'Test notes');
        vi.advanceTimersByTime(700);
      });

      expect(result.current.scenes.length).toBe(initialCount + 1);
      const newScene = result.current.scenes[result.current.scenes.length - 1];
      expect(newScene.name).toBe('New Scene');
      expect(newScene.notes).toBe('Test notes');
    });

    it('creates scene without notes', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await act(async () => {
        result.current.saveScene('No Notes Scene');
        vi.advanceTimersByTime(700);
      });

      const newScene = result.current.scenes[result.current.scenes.length - 1];
      expect(newScene.name).toBe('No Notes Scene');
      expect(newScene.notes).toBeUndefined();
    });
  });

  describe('createScene', () => {
    it('creates a new scene', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      const initialCount = result.current.scenes.length;

      await act(async () => {
        result.current.createScene('Created Scene', undefined, 'Created notes');
        vi.advanceTimersByTime(700);
      });

      expect(result.current.scenes.length).toBe(initialCount + 1);
      const newScene = result.current.scenes[result.current.scenes.length - 1];
      expect(newScene.name).toBe('Created Scene');
      expect(newScene.source).toBe('local');
    });

    it('copies notes from source scene when copyFromId is provided', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Copy from scene '1' which has notes
      await act(async () => {
        result.current.createScene('Copied Scene', '1');
        vi.advanceTimersByTime(700);
      });

      const newScene = result.current.scenes[result.current.scenes.length - 1];
      expect(newScene.name).toBe('Copied Scene');
      // Notes should be copied from source
      expect(newScene.notes).toBeDefined();
    });
  });

  describe('deleteScene', () => {
    it('removes scene from the list', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      const initialCount = result.current.scenes.length;
      const sceneToDelete = result.current.scenes[0];

      await act(async () => {
        result.current.deleteScene(sceneToDelete.id);
        vi.advanceTimersByTime(500);
      });

      expect(result.current.scenes.length).toBe(initialCount - 1);
      expect(result.current.scenes.find(s => s.id === sceneToDelete.id)).toBeUndefined();
    });
  });

  describe('refreshScenes', () => {
    it('reloads scenes', async () => {
      const { result } = renderHook(() => useScenes());

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      const sceneCount = result.current.scenes.length;

      await act(async () => {
        result.current.refreshScenes();
        vi.advanceTimersByTime(600);
      });

      expect(result.current.scenes.length).toBe(sceneCount);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('initializes with no error', () => {
      const { result } = renderHook(() => useScenes());
      expect(result.current.error).toBeNull();
    });
  });
});
