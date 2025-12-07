/**
 * Scene Storage Manager
 * Combines X32 internal scenes with local file storage
 */

import { createSceneFileManager, type SceneFileMetadata } from '../x32/scene-parser.js';
import { x32Connection } from '../x32/connection.js';
import type { X32Scene } from '../x32/types.js';

export interface StoredScene {
  id: string;
  name: string;
  index: number;
  source: 'x32' | 'local' | 'both';
  lastModified: string;
  hasLocalBackup: boolean;
  notes?: string;
}

export class SceneStorageManager {
  private sceneDir: string;
  private fileManager: ReturnType<typeof createSceneFileManager>;

  constructor(sceneDir: string) {
    this.sceneDir = sceneDir;
    this.fileManager = createSceneFileManager(sceneDir);
  }

  /**
   * Get all scenes from both X32 and local storage
   */
  async getAllScenes(): Promise<StoredScene[]> {
    const [x32Scenes, localFiles] = await Promise.all([
      this.getX32Scenes(),
      this.fileManager.listSceneFiles(),
    ]);

    // Create a map of local files by name for quick lookup
    const localFileMap = new Map<string, SceneFileMetadata>();
    for (const file of localFiles) {
      localFileMap.set(file.name.toLowerCase(), file);
    }

    // Merge X32 scenes with local file info
    const scenes: StoredScene[] = [];
    const processedLocalFiles = new Set<string>();

    for (const x32Scene of x32Scenes) {
      const localFile = localFileMap.get(x32Scene.name.toLowerCase());
      const hasLocalBackup = !!localFile;

      scenes.push({
        id: `x32-${x32Scene.index}`,
        name: x32Scene.name,
        index: x32Scene.index,
        source: hasLocalBackup ? 'both' : 'x32',
        lastModified: localFile?.lastModified.toISOString() || new Date().toISOString(),
        hasLocalBackup,
        notes: x32Scene.notes,
      });

      if (localFile) {
        processedLocalFiles.add(x32Scene.name.toLowerCase());
      }
    }

    // Add local-only scenes
    let localIndex = x32Scenes.length;
    for (const file of localFiles) {
      if (!processedLocalFiles.has(file.name.toLowerCase())) {
        scenes.push({
          id: `local-${file.name}`,
          name: file.name,
          index: localIndex++,
          source: 'local',
          lastModified: file.lastModified.toISOString(),
          hasLocalBackup: true,
          notes: undefined,
        });
      }
    }

    return scenes;
  }

  /**
   * Get scenes from X32
   */
  private async getX32Scenes(): Promise<X32Scene[]> {
    try {
      return await x32Connection.getScenes();
    } catch (error) {
      console.error('[SceneStorageManager] Failed to get X32 scenes:', error);
      return [];
    }
  }

  /**
   * Get current scene index
   */
  async getCurrentSceneIndex(): Promise<number | null> {
    try {
      return await x32Connection.getCurrentSceneIndex();
    } catch (error) {
      console.error('[SceneStorageManager] Failed to get current scene:', error);
      return null;
    }
  }

  /**
   * Load a scene by ID
   */
  async loadScene(sceneId: string): Promise<boolean> {
    // Parse the scene ID to determine source
    if (sceneId.startsWith('x32-')) {
      const index = parseInt(sceneId.replace('x32-', ''), 10);
      return x32Connection.loadScene(index);
    }

    // For local scenes, we'd need to upload to X32 first
    // This is a more complex operation for future implementation
    console.log(`[SceneStorageManager] Loading local scene: ${sceneId}`);
    return false;
  }

  /**
   * Save current X32 state as a new scene
   */
  async saveScene(name: string, notes?: string): Promise<StoredScene> {
    // Generate a template scene file
    const content = this.fileManager.generateTemplate(name, notes || '');

    // Save to local storage
    await this.fileManager.writeSceneFile(name, content);

    // In production, we'd also save to X32 internal memory
    // For now, just return the local scene

    return {
      id: `local-${name}`,
      name,
      index: -1, // Will be assigned when synced
      source: 'local',
      lastModified: new Date().toISOString(),
      hasLocalBackup: true,
      notes,
    };
  }

  /**
   * Delete a scene
   */
  async deleteScene(sceneId: string): Promise<boolean> {
    // Parse the scene ID
    if (sceneId.startsWith('local-')) {
      const name = sceneId.replace('local-', '');
      return this.fileManager.deleteSceneFile(name);
    }

    // For X32 scenes, we only delete the local backup
    if (sceneId.startsWith('x32-')) {
      // Find the scene to get its name
      const scenes = await this.getAllScenes();
      const scene = scenes.find(s => s.id === sceneId);
      if (scene) {
        return this.fileManager.deleteSceneFile(scene.name);
      }
    }

    return false;
  }

  /**
   * Get a single scene by ID
   */
  async getScene(sceneId: string): Promise<StoredScene | null> {
    const scenes = await this.getAllScenes();
    return scenes.find(s => s.id === sceneId) || null;
  }

  /**
   * Backup a scene to local storage
   */
  async backupScene(sceneId: string): Promise<boolean> {
    const scene = await this.getScene(sceneId);
    if (!scene) return false;

    const content = this.fileManager.generateTemplate(scene.name, scene.notes || '');
    await this.fileManager.writeSceneFile(scene.name, content);
    return true;
  }
}

// Factory function
export function createSceneStorageManager(sceneDir: string): SceneStorageManager {
  return new SceneStorageManager(sceneDir);
}
