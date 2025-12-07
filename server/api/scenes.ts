/**
 * Scene API Routes
 * REST endpoints for scene management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createSceneStorageManager } from '../storage/file-manager.js';
import { x32Connection } from '../x32/connection.js';

// Input validation schemas
// Scene IDs must match format: x32-{number} or local-{alphanumeric name}
const sceneIdSchema = z.string()
  .min(1)
  .max(256)
  .regex(/^(x32-\d+|local-[a-zA-Z0-9_-]+|\d+)$/, {
    message: 'Scene ID must be in format: x32-{number}, local-{name}, or numeric index',
  });

const createSceneSchema = z.object({
  name: z.string().min(1).max(32).trim(),
  notes: z.string().max(200).optional().default(''),
  copyFromId: z.string()
    .max(256)
    .regex(/^(x32-\d+|local-[a-zA-Z0-9_-]+|\d+)$/, {
      message: 'copyFromId must be in format: x32-{number}, local-{name}, or numeric index',
    })
    .optional(),
});

const updateSceneSchema = z.object({
  name: z.string().min(1).max(32).trim().optional(),
  notes: z.string().max(200).optional(),
});

const router = Router();

// Scene storage manager - initialized when routes are registered
let storageManager: ReturnType<typeof createSceneStorageManager>;

/**
 * Initialize the API with scene directory
 */
export function initScenesApi(sceneDir: string): Router {
  storageManager = createSceneStorageManager(sceneDir);
  return router;
}

/**
 * GET /api/scenes
 * List all scenes
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const scenes = await storageManager.getAllScenes();
    const currentSceneIndex = await storageManager.getCurrentSceneIndex();

    res.json({
      success: true,
      data: {
        scenes,
        currentSceneIndex,
        connectionStatus: x32Connection.getState(),
      },
    });
  } catch (error) {
    console.error('[API] Error listing scenes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list scenes',
    });
  }
});

/**
 * GET /api/scenes/:id
 * Get a single scene by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const sceneId = sceneIdSchema.parse(req.params.id);
    const scene = await storageManager.getScene(sceneId);

    if (!scene) {
      res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
      return;
    }

    res.json({
      success: true,
      data: scene,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid scene ID' });
      return;
    }
    console.error('[API] Error getting scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene',
    });
  }
});

/**
 * POST /api/scenes
 * Create a new scene
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, notes, copyFromId } = createSceneSchema.parse(req.body);

    // If copying from another scene, get its content first
    let sourceNotes: string = notes;
    if (copyFromId) {
      const sourceScene = await storageManager.getScene(copyFromId);
      if (sourceScene && !notes) {
        sourceNotes = sourceScene.notes || '';
      }
    }

    const scene = await storageManager.saveScene(name, sourceNotes);

    res.status(201).json({
      success: true,
      data: scene,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('[API] Error creating scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create scene',
    });
  }
});

/**
 * PUT /api/scenes/:id
 * Update a scene
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const sceneId = sceneIdSchema.parse(req.params.id);
    const { name, notes } = updateSceneSchema.parse(req.body);

    const existingScene = await storageManager.getScene(sceneId);
    if (!existingScene) {
      res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
      return;
    }

    // For now, we can only update local scenes
    // X32 scenes would need direct OSC commands
    if (existingScene.source === 'x32') {
      res.status(400).json({
        success: false,
        error: 'Cannot directly modify X32 internal scenes',
      });
      return;
    }

    // Re-save with updated info
    const updatedScene = await storageManager.saveScene(
      name || existingScene.name,
      notes !== undefined ? notes : existingScene.notes
    );

    res.json({
      success: true,
      data: updatedScene,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.issues });
      return;
    }
    console.error('[API] Error updating scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scene',
    });
  }
});

/**
 * DELETE /api/scenes/:id
 * Delete a scene
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const sceneId = sceneIdSchema.parse(req.params.id);
    const deleted = await storageManager.deleteScene(sceneId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Scene not found or cannot be deleted',
      });
      return;
    }

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid scene ID' });
      return;
    }
    console.error('[API] Error deleting scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete scene',
    });
  }
});

/**
 * POST /api/scenes/:id/load
 * Load a scene to the X32
 */
router.post('/:id/load', async (req: Request, res: Response): Promise<void> => {
  try {
    const sceneId = sceneIdSchema.parse(req.params.id);
    const loaded = await storageManager.loadScene(sceneId);

    if (!loaded) {
      res.status(400).json({
        success: false,
        error: 'Failed to load scene',
      });
      return;
    }

    res.json({
      success: true,
      data: { loaded: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid scene ID' });
      return;
    }
    console.error('[API] Error loading scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load scene',
    });
  }
});

/**
 * POST /api/scenes/:id/backup
 * Backup a scene to local storage
 */
router.post('/:id/backup', async (req: Request, res: Response): Promise<void> => {
  try {
    const sceneId = sceneIdSchema.parse(req.params.id);
    const backed = await storageManager.backupScene(sceneId);

    if (!backed) {
      res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { backed: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid scene ID' });
      return;
    }
    console.error('[API] Error backing up scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to backup scene',
    });
  }
});

export default router;
