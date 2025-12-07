/**
 * X32 Scene File Parser
 * Parses and generates .scn files for the Behringer X32 mixer
 *
 * Scene files are plain ASCII text with ~2000+ lines containing
 * every console parameter in OSC address format.
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface SceneFileMetadata {
  /** File name without extension */
  name: string;
  /** Full file path */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  lastModified: Date;
}

export interface SceneFileContent {
  /** Raw content of the .scn file */
  raw: string;
  /** Parsed scene name from file */
  name?: string;
  /** Parsed notes from file */
  notes?: string;
  /** Line count */
  lineCount: number;
}

/**
 * Scene File Manager
 * Handles reading, writing, and parsing of .scn files
 */
export class SceneFileManager {
  private sceneDir: string;

  constructor(sceneDir: string) {
    this.sceneDir = sceneDir;
  }

  /**
   * Ensure the scene directory exists
   */
  async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.sceneDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * List all .scn files in the scene directory
   */
  async listSceneFiles(): Promise<SceneFileMetadata[]> {
    await this.ensureDirectory();

    const files = await fs.readdir(this.sceneDir);
    const scnFiles = files.filter(f => f.toLowerCase().endsWith('.scn'));

    const metadata: SceneFileMetadata[] = [];

    for (const file of scnFiles) {
      const filePath = path.join(this.sceneDir, file);
      const stats = await fs.stat(filePath);

      metadata.push({
        name: path.basename(file, '.scn'),
        filePath,
        size: stats.size,
        lastModified: stats.mtime,
      });
    }

    // Sort by modification date, newest first
    return metadata.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  /**
   * Read a scene file
   */
  async readSceneFile(filename: string): Promise<SceneFileContent | null> {
    const filePath = this.getFilePath(filename);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return this.parseSceneContent(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write a scene file
   */
  async writeSceneFile(filename: string, content: string): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.getFilePath(filename);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Delete a scene file
   */
  async deleteSceneFile(filename: string): Promise<boolean> {
    const filePath = this.getFilePath(filename);

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Rename a scene file
   */
  async renameSceneFile(oldName: string, newName: string): Promise<boolean> {
    const oldPath = this.getFilePath(oldName);
    const newPath = this.getFilePath(newName);

    try {
      await fs.rename(oldPath, newPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if a scene file exists
   */
  async exists(filename: string): Promise<boolean> {
    const filePath = this.getFilePath(filename);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse scene file content to extract metadata
   */
  private parseSceneContent(raw: string): SceneFileContent {
    const lines = raw.split('\n');

    // Try to extract scene name from first line (often "#2.1# "Name")
    let name: string | undefined;
    let notes: string | undefined;

    for (const line of lines) {
      // Look for scene name marker
      if (line.startsWith('#') && !name) {
        const match = line.match(/^#[\d.]+#\s*"?([^"]+)"?/);
        if (match) {
          name = match[1].trim();
        }
      }

      // Look for notes (sometimes in /scene/notes format)
      if (line.includes('/scene/notes') && !notes) {
        const match = line.match(/\/scene\/notes\s+"([^"]+)"/);
        if (match) {
          notes = match[1];
        }
      }
    }

    return {
      raw,
      name,
      notes,
      lineCount: lines.length,
    };
  }

  /**
   * Get full file path for a scene name
   */
  private getFilePath(filename: string): string {
    // Sanitize filename
    const sanitized = filename
      .replace(/[<>:"/\\|?*]/g, '_')  // Remove invalid chars
      .replace(/\.+$/g, '');           // Remove trailing dots

    const withExtension = sanitized.endsWith('.scn') ? sanitized : `${sanitized}.scn`;
    return path.join(this.sceneDir, withExtension);
  }

  /**
   * Generate a basic scene file template
   * In production, this would capture the current X32 state
   */
  generateTemplate(name: string, notes: string = ''): string {
    const timestamp = new Date().toISOString();

    return `#4.06# "${name}"
# X32 Scene File
# Generated: ${timestamp}
# Notes: ${notes}

# This is a placeholder template.
# In production, this would contain the full X32 state.

/scene/name "${name}"
/scene/notes "${notes}"

# End of scene file
`;
  }
}

// Factory function to create a SceneFileManager
export function createSceneFileManager(sceneDir: string): SceneFileManager {
  return new SceneFileManager(sceneDir);
}
