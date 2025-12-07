/**
 * Mock X32 Simulator
 * Simulates X32 responses for development without hardware
 */

import type { X32Info, X32Scene, OSCMessage, OSCArgument } from './types.js';
import { X32_OSC_ADDRESSES } from './types.js';
import { createOSCMessage, formatSceneIndex } from './osc-utils.js';

export class MockX32 {
  private info: X32Info = {
    ip: '192.168.0.64',
    name: 'X32-MOCK',
    model: 'X32',
    firmware: '4.06',
  };

  private scenes: X32Scene[] = [
    { index: 0, name: 'Sunday Worship', notes: 'Standard Sunday morning configuration' },
    { index: 1, name: 'Youth Night', notes: 'Louder mix, more bass for youth events' },
    { index: 2, name: 'Wednesday Bible Study', notes: 'Simple setup - pastor mic + ambient' },
    { index: 3, name: 'Band Practice', notes: '' },
    { index: 4, name: 'Christmas Eve Service', notes: 'Special holiday configuration with orchestra' },
    { index: 5, name: 'Guest Speaker', notes: 'Minimal setup for visiting speakers' },
  ];

  private currentSceneIndex = 0;

  /**
   * Handle an incoming OSC message and return a response
   */
  handleMessage(message: OSCMessage): OSCMessage | null {
    const { address, args } = message;

    // /xinfo - Return console info
    if (address === X32_OSC_ADDRESSES.INFO) {
      return {
        address: X32_OSC_ADDRESSES.INFO,
        args: [
          { type: 's', value: this.info.ip },
          { type: 's', value: this.info.name },
          { type: 's', value: this.info.model },
          { type: 's', value: this.info.firmware },
        ],
      };
    }

    // /-show/prepos/current - Get/Set current scene
    if (address === X32_OSC_ADDRESSES.SCENE_CURRENT) {
      if (args.length > 0 && args[0].type === 'i') {
        // Set current scene
        this.currentSceneIndex = args[0].value;
        console.log(`[MockX32] Loaded scene ${this.currentSceneIndex}`);
      }
      return {
        address: X32_OSC_ADDRESSES.SCENE_CURRENT,
        args: [{ type: 'i', value: this.currentSceneIndex }],
      };
    }

    // /-show/showfile/scene/XXX/name - Get scene name
    const sceneNameMatch = address.match(/\/-show\/showfile\/scene\/(\d{3})\/name/);
    if (sceneNameMatch) {
      const sceneIndex = parseInt(sceneNameMatch[1], 10);
      const scene = this.scenes.find(s => s.index === sceneIndex);
      return {
        address,
        args: [{ type: 's', value: scene?.name || '' }],
      };
    }

    // /-show/showfile/scene/XXX/notes - Get scene notes
    const sceneNotesMatch = address.match(/\/-show\/showfile\/scene\/(\d{3})\/notes/);
    if (sceneNotesMatch) {
      const sceneIndex = parseInt(sceneNotesMatch[1], 10);
      const scene = this.scenes.find(s => s.index === sceneIndex);
      return {
        address,
        args: [{ type: 's', value: scene?.notes || '' }],
      };
    }

    // /xremote - Keep-alive, no response needed
    if (address === X32_OSC_ADDRESSES.XREMOTE) {
      return null;
    }

    // Unknown command - return empty response
    console.log(`[MockX32] Unknown command: ${address}`);
    return null;
  }

  /**
   * Get all scenes
   */
  getScenes(): X32Scene[] {
    return [...this.scenes];
  }

  /**
   * Get current scene index
   */
  getCurrentSceneIndex(): number {
    return this.currentSceneIndex;
  }

  /**
   * Get console info
   */
  getInfo(): X32Info {
    return { ...this.info };
  }

  /**
   * Add a new scene
   */
  addScene(name: string, notes: string = ''): X32Scene {
    const newIndex = this.scenes.length;
    const newScene: X32Scene = { index: newIndex, name, notes };
    this.scenes.push(newScene);
    return newScene;
  }

  /**
   * Delete a scene by index
   */
  deleteScene(index: number): boolean {
    const sceneIdx = this.scenes.findIndex(s => s.index === index);
    if (sceneIdx !== -1) {
      this.scenes.splice(sceneIdx, 1);
      // Re-index remaining scenes
      this.scenes.forEach((s, i) => { s.index = i; });
      return true;
    }
    return false;
  }

  /**
   * Set current scene
   */
  setCurrentScene(index: number): boolean {
    if (index >= 0 && index < this.scenes.length) {
      this.currentSceneIndex = index;
      return true;
    }
    return false;
  }
}

// Singleton instance for the mock X32
export const mockX32 = new MockX32();
