import { describe, it, expect, beforeEach } from 'vitest';
import { MockX32 } from './mock-x32.js';
import type { OSCMessage } from './types.js';
import { X32_OSC_ADDRESSES } from './types.js';

describe('MockX32', () => {
  let mockX32: MockX32;

  beforeEach(() => {
    mockX32 = new MockX32();
  });

  describe('Console Info', () => {
    it('returns correct info for /xinfo', () => {
      const message: OSCMessage = {
        address: X32_OSC_ADDRESSES.INFO,
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response).not.toBeNull();
      expect(response?.address).toBe(X32_OSC_ADDRESSES.INFO);
      expect(response?.args).toHaveLength(4);
      expect(response?.args[0]).toEqual({ type: 's', value: '192.168.0.64' });
      expect(response?.args[1]).toEqual({ type: 's', value: 'X32-MOCK' });
      expect(response?.args[2]).toEqual({ type: 's', value: 'X32' });
      expect(response?.args[3]).toEqual({ type: 's', value: '4.06' });
    });

    it('getInfo returns console information', () => {
      const info = mockX32.getInfo();

      expect(info).toEqual({
        ip: '192.168.0.64',
        name: 'X32-MOCK',
        model: 'X32',
        firmware: '4.06',
      });
    });

    it('getInfo returns a copy of info object', () => {
      const info1 = mockX32.getInfo();
      const info2 = mockX32.getInfo();

      expect(info1).toEqual(info2);
      expect(info1).not.toBe(info2); // Different object references
    });
  });

  describe('Scene Management', () => {
    it('handles scene load command', () => {
      const message: OSCMessage = {
        address: X32_OSC_ADDRESSES.SCENE_CURRENT,
        args: [{ type: 'i', value: 2 }],
      };

      const response = mockX32.handleMessage(message);

      expect(response).not.toBeNull();
      expect(response?.address).toBe(X32_OSC_ADDRESSES.SCENE_CURRENT);
      expect(response?.args).toHaveLength(1);
      expect(response?.args[0]).toEqual({ type: 'i', value: 2 });
    });

    it('returns current scene index when no args provided', () => {
      // First set a scene
      mockX32.handleMessage({
        address: X32_OSC_ADDRESSES.SCENE_CURRENT,
        args: [{ type: 'i', value: 3 }],
      });

      // Then query it
      const response = mockX32.handleMessage({
        address: X32_OSC_ADDRESSES.SCENE_CURRENT,
        args: [],
      });

      expect(response?.args[0]).toEqual({ type: 'i', value: 3 });
    });

    it('getCurrentSceneIndex returns current scene', () => {
      mockX32.setCurrentScene(4);
      expect(mockX32.getCurrentSceneIndex()).toBe(4);
    });

    it('setCurrentScene updates current scene', () => {
      const result = mockX32.setCurrentScene(2);

      expect(result).toBe(true);
      expect(mockX32.getCurrentSceneIndex()).toBe(2);
    });

    it('setCurrentScene rejects invalid index (negative)', () => {
      const result = mockX32.setCurrentScene(-1);

      expect(result).toBe(false);
      expect(mockX32.getCurrentSceneIndex()).toBe(0); // Should remain at initial value
    });

    it('setCurrentScene rejects invalid index (out of range)', () => {
      const result = mockX32.setCurrentScene(999);

      expect(result).toBe(false);
      expect(mockX32.getCurrentSceneIndex()).toBe(0);
    });
  });

  describe('Scene Names', () => {
    it('returns scene names for valid indices', () => {
      const message: OSCMessage = {
        address: '/-show/showfile/scene/000/name',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response).not.toBeNull();
      expect(response?.args).toHaveLength(1);
      expect(response?.args[0].type).toBe('s');
      expect(response?.args[0].value).toBe('Sunday Worship');
    });

    it('returns different scene names for different indices', () => {
      const response1 = mockX32.handleMessage({
        address: '/-show/showfile/scene/001/name',
        args: [],
      });

      const response2 = mockX32.handleMessage({
        address: '/-show/showfile/scene/002/name',
        args: [],
      });

      expect(response1?.args[0].value).toBe('Youth Night');
      expect(response2?.args[0].value).toBe('Wednesday Bible Study');
    });

    it('returns empty string for non-existent scene', () => {
      const message: OSCMessage = {
        address: '/-show/showfile/scene/099/name',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response?.args[0]).toEqual({ type: 's', value: '' });
    });
  });

  describe('Scene Notes', () => {
    it('returns scene notes for valid indices', () => {
      const message: OSCMessage = {
        address: '/-show/showfile/scene/000/notes',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response).not.toBeNull();
      expect(response?.args[0].type).toBe('s');
      expect(response?.args[0].value).toBe('Standard Sunday morning configuration');
    });

    it('returns different notes for different scenes', () => {
      const response1 = mockX32.handleMessage({
        address: '/-show/showfile/scene/001/notes',
        args: [],
      });

      expect(response1?.args[0].value).toBe('Louder mix, more bass for youth events');
    });

    it('returns empty string for scene without notes', () => {
      const message: OSCMessage = {
        address: '/-show/showfile/scene/003/notes',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response?.args[0]).toEqual({ type: 's', value: '' });
    });

    it('returns empty string for non-existent scene notes', () => {
      const message: OSCMessage = {
        address: '/-show/showfile/scene/099/notes',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response?.args[0]).toEqual({ type: 's', value: '' });
    });
  });

  describe('Scene CRUD Operations', () => {
    it('getScenes returns all scenes', () => {
      const scenes = mockX32.getScenes();

      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes[0]).toHaveProperty('index');
      expect(scenes[0]).toHaveProperty('name');
      expect(scenes[0]).toHaveProperty('notes');
    });

    it('getScenes returns a copy of scenes array', () => {
      const scenes1 = mockX32.getScenes();
      const scenes2 = mockX32.getScenes();

      expect(scenes1).toEqual(scenes2);
      expect(scenes1).not.toBe(scenes2); // Different array references
    });

    it('addScene creates a new scene', () => {
      const initialCount = mockX32.getScenes().length;

      const newScene = mockX32.addScene('New Test Scene', 'Test notes');

      expect(newScene.name).toBe('New Test Scene');
      expect(newScene.notes).toBe('Test notes');
      expect(newScene.index).toBe(initialCount);

      const scenes = mockX32.getScenes();
      expect(scenes.length).toBe(initialCount + 1);
      expect(scenes[scenes.length - 1]).toEqual(newScene);
    });

    it('addScene without notes creates scene with empty notes', () => {
      const newScene = mockX32.addScene('Scene Without Notes');

      expect(newScene.notes).toBe('');
    });

    it('addScene assigns sequential indices', () => {
      const scene1 = mockX32.addScene('Scene 1');
      const scene2 = mockX32.addScene('Scene 2');
      const scene3 = mockX32.addScene('Scene 3');

      expect(scene2.index).toBe(scene1.index + 1);
      expect(scene3.index).toBe(scene2.index + 1);
    });

    it('deleteScene removes scene by index', () => {
      const scenes = mockX32.getScenes();
      const sceneToDelete = scenes[1];
      const initialCount = scenes.length;

      const result = mockX32.deleteScene(sceneToDelete.index);

      expect(result).toBe(true);
      expect(mockX32.getScenes().length).toBe(initialCount - 1);

      const remainingScenes = mockX32.getScenes();
      const deletedScene = remainingScenes.find(s => s.name === sceneToDelete.name);
      expect(deletedScene).toBeUndefined();
    });

    it('deleteScene re-indexes remaining scenes', () => {
      // Delete the first scene
      mockX32.deleteScene(0);

      const scenes = mockX32.getScenes();

      // Check that indices are sequential starting from 0
      scenes.forEach((scene, i) => {
        expect(scene.index).toBe(i);
      });
    });

    it('deleteScene returns false for non-existent index', () => {
      const result = mockX32.deleteScene(999);

      expect(result).toBe(false);
    });

    it('deleteScene handles deleting all scenes', () => {
      const scenes = mockX32.getScenes();

      // Delete all scenes
      for (let i = scenes.length - 1; i >= 0; i--) {
        mockX32.deleteScene(0); // Always delete index 0
      }

      expect(mockX32.getScenes().length).toBe(0);
    });
  });

  describe('Keep-alive', () => {
    it('handles /xremote without response', () => {
      const message: OSCMessage = {
        address: X32_OSC_ADDRESSES.XREMOTE,
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response).toBeNull();
    });
  });

  describe('Unknown Commands', () => {
    it('returns null for unknown command', () => {
      const message: OSCMessage = {
        address: '/unknown/command',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response).toBeNull();
    });

    it('returns null for invalid scene address format', () => {
      const message: OSCMessage = {
        address: '/-show/showfile/scene/invalid/name',
        args: [],
      };

      const response = mockX32.handleMessage(message);

      expect(response).toBeNull();
    });
  });
});
