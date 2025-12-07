/**
 * Backup API Routes
 * Endpoints for creating full show backups from X32
 *
 * Supports two backup formats:
 * 1. JSON metadata backup - Quick snapshot of scene list
 * 2. Full .scn backup - USB-compatible scene file with all parameters (~2000+ lines)
 */

import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { x32Connection } from '../x32/connection.js';
import { exportSceneToScn, type ExportResult } from '../x32/scene-exporter.js';
import { exportConsoleBackup, type ConsoleBackupResult } from '../x32/console-backup-exporter.js';
import { loadSceneFromScn, type LoadResult } from '../x32/scene-loader.js';

const router = Router();

// Backup directory
let backupDir: string;

export interface ShowBackup {
  timestamp: string;
  filename: string;
  consoleName: string;
  consoleModel: string;
  firmware: string;
  scenesBackedUp: number;
  currentSceneIndex: number;
  scenes: Array<{
    index: number;
    name: string;
    notes: string;
  }>;
}

export interface FullSceneBackup {
  timestamp: string;
  filename: string;
  consoleName: string;
  consoleModel: string;
  firmware: string;
  parameterCount: number;
  duration: number;
  format: 'scn';
}

/**
 * Initialize the backup API with directory
 */
export function initBackupApi(dir: string): Router {
  backupDir = dir;
  return router;
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * GET /api/backup
 * List all backups (.json metadata, .scn scene backups, and .bak console backups)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(backupDir);

    const backups: Array<{
      filename: string;
      timestamp: string;
      consoleName: string;
      scenesCount?: number;
      parameterCount?: number;
      size: number;
      format: 'json' | 'scn' | 'bak';
      restoreMethod?: string;
    }> = [];

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);

      if (file.endsWith('.json')) {
        // JSON metadata backup
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const backup = JSON.parse(content) as ShowBackup;
          backups.push({
            filename: file,
            timestamp: backup.timestamp,
            consoleName: backup.consoleName,
            scenesCount: backup.scenesBackedUp,
            size: stats.size,
            format: 'json',
          });
        } catch {
          // Skip invalid JSON files
        }
      } else if (file.endsWith('.scn')) {
        // Scene .scn backup - parse header for metadata
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          // Extract info from header: #firmware# "SceneName" "Notes" safetymask hasaliases
          const headerMatch = lines[0]?.match(/^#([\d.]+)#\s*"([^"]+)"/);

          // Extract timestamp from filename if present
          const timestampMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
          const timestamp = timestampMatch
            ? timestampMatch[1].replace(/-/g, (m, i) => (i > 9 ? ':' : m))
            : stats.mtime.toISOString();

          // Extract console name from filename
          const consoleMatch = file.match(/^([^_]+)_/);
          const consoleName = consoleMatch?.[1] || 'Unknown';

          backups.push({
            filename: file,
            timestamp,
            consoleName: consoleName.replace(/_/g, '-'),
            parameterCount: lines.length - 1,
            size: stats.size,
            format: 'scn',
            restoreMethod: 'Scenes > Utility > Import',
          });
        } catch {
          // Skip unreadable files
        }
      } else if (file.endsWith('.bak')) {
        // Full console.bak backup
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          // Extract info from header
          const headerMatch = lines[0]?.match(/^#([\d.]+)#\s*"([^"]+)"/);

          // Extract timestamp from filename if present
          const timestampMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
          const timestamp = timestampMatch
            ? timestampMatch[1].replace(/-/g, (m, i) => (i > 9 ? ':' : m))
            : stats.mtime.toISOString();

          // Extract console name from filename
          const consoleMatch = file.match(/^([^_]+)_/);
          const consoleName = consoleMatch?.[1] || 'Unknown';

          backups.push({
            filename: file,
            timestamp,
            consoleName: consoleName.replace(/_/g, '-'),
            parameterCount: lines.length - 1,
            size: stats.size,
            format: 'bak',
            restoreMethod: 'Setup > Global > Restore',
          });
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Sort by timestamp, newest first
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: backups,
    });
  } catch (error) {
    console.error('[Backup API] Error listing backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
    });
  }
});

/**
 * POST /api/backup
 * Create a new full show backup
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check connection status
    const state = x32Connection.getState();
    if (state !== 'connected' && state !== 'mock') {
      res.status(503).json({
        success: false,
        error: 'Not connected to X32',
      });
      return;
    }

    // Get console info
    const info = await x32Connection.getInfo();
    if (!info) {
      res.status(503).json({
        success: false,
        error: 'Could not get X32 info',
      });
      return;
    }

    // Get all scenes from X32
    console.log('[Backup API] Starting full show backup...');
    const scenes = await x32Connection.getScenes();
    const currentSceneIndex = await x32Connection.getCurrentSceneIndex();

    // Create backup object
    const timestamp = new Date().toISOString();
    const backup: ShowBackup = {
      timestamp,
      filename: '',
      consoleName: info.name,
      consoleModel: info.model,
      firmware: info.firmware,
      scenesBackedUp: scenes.length,
      currentSceneIndex,
      scenes: scenes.map(s => ({
        index: s.index,
        name: s.name,
        notes: s.notes,
      })),
    };

    // Generate filename
    const dateStr = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const safeConsoleName = info.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${safeConsoleName}_${dateStr}.json`;
    backup.filename = filename;

    // Save backup file
    await ensureBackupDir();
    const filePath = path.join(backupDir, filename);
    await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf-8');

    console.log(`[Backup API] Backup created: ${filename} (${scenes.length} scenes)`);

    res.status(201).json({
      success: true,
      data: {
        filename,
        timestamp,
        scenesBackedUp: scenes.length,
        consoleName: info.name,
      },
    });
  } catch (error) {
    console.error('[Backup API] Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
    });
  }
});

/**
 * GET /api/backup/:filename
 * Download a specific backup (.json, .scn, or .bak)
 */
router.get('/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const validExtension = filename.endsWith('.json') || filename.endsWith('.scn') || filename.endsWith('.bak');
    if (sanitizedFilename !== filename || !validExtension) {
      res.status(400).json({
        success: false,
        error: 'Invalid filename',
      });
      return;
    }

    const filePath = path.join(backupDir, sanitizedFilename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (filename.endsWith('.scn') || filename.endsWith('.bak')) {
        // For .scn and .bak files, offer as download
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
        res.send(content);
      } else {
        // For JSON files, parse and return as JSON
        const backup = JSON.parse(content) as ShowBackup;
        res.json({
          success: true,
          data: backup,
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: 'Backup not found',
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('[Backup API] Error getting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup',
    });
  }
});

/**
 * POST /api/backup/full
 * Create a USB-compatible full .scn backup of the current console state
 * This captures ALL mixer parameters (~2000+ values) and generates a file
 * that can be loaded via USB on the X32
 */
router.post('/full', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get X32 connection config
    const config = x32Connection.getConfig();

    if (config.mockMode) {
      res.status(503).json({
        success: false,
        error: 'Full backup not available in mock mode - requires real X32 connection',
      });
      return;
    }

    // Check connection status
    const state = x32Connection.getState();
    if (state !== 'connected') {
      res.status(503).json({
        success: false,
        error: 'Not connected to X32',
      });
      return;
    }

    // Optional scene name from request body
    const { sceneName = 'Full-Backup', notes = '' } = req.body || {};

    console.log('[Backup API] Starting full .scn backup...');
    const startTime = Date.now();

    // Export all parameters
    const result: ExportResult = await exportSceneToScn({
      ip: config.ip,
      port: config.port,
      sceneName,
      notes,
      timeout: 500,
      onProgress: (current, total, section) => {
        if (current % 100 === 0) {
          console.log(`[Backup API] Progress: ${current}/${total} (${section})`);
        }
      },
    });

    // Generate filename
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const safeConsoleName = result.consoleInfo.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${safeConsoleName}_${dateStr}.scn`;

    // Save backup file
    await ensureBackupDir();
    const filePath = path.join(backupDir, filename);
    await fs.writeFile(filePath, result.content, 'utf-8');

    const elapsed = Date.now() - startTime;
    console.log(`[Backup API] Full backup created: ${filename} (${result.parameterCount} parameters in ${elapsed}ms)`);

    res.status(201).json({
      success: true,
      data: {
        filename,
        timestamp,
        consoleName: result.consoleInfo.name,
        consoleModel: result.consoleInfo.model,
        firmware: result.consoleInfo.firmware,
        parameterCount: result.parameterCount,
        duration: result.duration,
        format: 'scn',
        usbCompatible: true,
      },
    });
  } catch (error) {
    console.error('[Backup API] Error creating full backup:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create full backup',
    });
  }
});

/**
 * POST /api/backup/console
 * Create a FULL console.bak backup matching X32's Setup > Backup > Export
 * This includes ALL 100 scenes, ALL 100 snippets, ALL library presets, and current state
 * Restores via Setup > Global > Restore on the X32
 */
router.post('/console', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get X32 connection config
    const config = x32Connection.getConfig();

    if (config.mockMode) {
      res.status(503).json({
        success: false,
        error: 'Console backup not available in mock mode - requires real X32 connection',
      });
      return;
    }

    // Check connection status
    const state = x32Connection.getState();
    if (state !== 'connected') {
      res.status(503).json({
        success: false,
        error: 'Not connected to X32',
      });
      return;
    }

    console.log('[Backup API] Starting FULL console.bak backup...');
    console.log('[Backup API] This will backup ALL scenes, snippets, presets, and settings');
    const startTime = Date.now();

    // Export all console data
    const result: ConsoleBackupResult = await exportConsoleBackup({
      ip: config.ip,
      port: config.port,
      timeout: 500,
      onProgress: (current, total, section) => {
        if (current % 100 === 0) {
          console.log(`[Backup API] Console backup progress: ${current}/${total} (${section})`);
        }
      },
    });

    // Generate filename matching X32 format
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const safeConsoleName = result.consoleInfo.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${safeConsoleName}_${dateStr}.bak`;

    // Save backup file
    await ensureBackupDir();
    const filePath = path.join(backupDir, filename);
    await fs.writeFile(filePath, result.content, 'utf-8');

    const elapsed = Date.now() - startTime;
    console.log(`[Backup API] Console backup created: ${filename}`);
    console.log(`[Backup API] Parameters: ${result.parameterCount}, Scenes: ${result.sceneCount}, Snippets: ${result.snippetCount}`);
    console.log(`[Backup API] Duration: ${elapsed}ms`);

    res.status(201).json({
      success: true,
      data: {
        filename,
        timestamp,
        consoleName: result.consoleInfo.name,
        consoleModel: result.consoleInfo.model,
        firmware: result.consoleInfo.firmware,
        parameterCount: result.parameterCount,
        sceneCount: result.sceneCount,
        snippetCount: result.snippetCount,
        duration: result.duration,
        format: 'bak',
        restoreMethod: 'Setup > Global > Restore',
      },
    });
  } catch (error) {
    console.error('[Backup API] Error creating console backup:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create console backup',
    });
  }
});

/**
 * DELETE /api/backup/:filename
 * Delete a backup (.json, .scn, or .bak)
 */
router.delete('/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const validExtension = filename.endsWith('.json') || filename.endsWith('.scn') || filename.endsWith('.bak');
    if (sanitizedFilename !== filename || !validExtension) {
      res.status(400).json({
        success: false,
        error: 'Invalid filename',
      });
      return;
    }

    const filePath = path.join(backupDir, sanitizedFilename);

    try {
      await fs.unlink(filePath);
      res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: 'Backup not found',
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('[Backup API] Error deleting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
    });
  }
});

/**
 * POST /api/backup/:filename/load
 * Load a .scn backup file directly to the X32
 * This sends all parameters from the backup file as OSC commands to restore the mixer state
 */
router.post('/:filename/load', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate filename
    const sanitizedFilename = path.basename(filename);
    if (sanitizedFilename !== filename || !filename.endsWith('.scn')) {
      res.status(400).json({
        success: false,
        error: 'Invalid filename. Only .scn files can be loaded',
      });
      return;
    }

    // Check connection status
    const config = x32Connection.getConfig();
    if (config.mockMode) {
      res.status(503).json({
        success: false,
        error: 'Loading backups not available in mock mode - requires real X32 connection',
      });
      return;
    }

    const state = x32Connection.getState();
    if (state !== 'connected') {
      res.status(503).json({
        success: false,
        error: 'Not connected to X32',
      });
      return;
    }

    // Read the backup file
    const filePath = path.join(backupDir, sanitizedFilename);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: 'Backup file not found',
        });
        return;
      }
      throw error;
    }

    console.log(`[Backup API] Loading backup: ${filename}`);
    const startTime = Date.now();

    // Load the scene to the X32
    const result: LoadResult = await loadSceneFromScn(content, {
      ip: config.ip,
      port: config.port,
      commandDelay: 5,
      onProgress: (current, total, section) => {
        if (current % 200 === 0) {
          console.log(`[Backup API] Load progress: ${current}/${total} (${section})`);
        }
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Backup API] Backup loaded: ${result.parameterCount} parameters in ${elapsed}ms (${result.errors} errors)`);

    res.json({
      success: true,
      data: {
        filename,
        parameterCount: result.parameterCount,
        duration: result.duration,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('[Backup API] Error loading backup:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load backup',
    });
  }
});

export default router;
