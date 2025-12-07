/**
 * Fetch Fallback Utility for Tests
 *
 * Implements a graceful fallback chain:
 * 1. Try localhost server
 * 2. Try to start Docker container
 * 3. Fall back to mock responses
 */

import { vi } from 'vitest';
import type { Scene } from '../types/scene';

// Mock data for fallback responses
const mockScenes: Scene[] = [
  {
    id: '1',
    name: 'Sunday Morning',
    index: 0,
    source: 'both',
    lastModified: '2024-12-01T10:30:00Z',
    hasLocalBackup: true,
    notes: 'Main service scene with full band setup',
  },
  {
    id: '2',
    name: 'Wednesday Night',
    index: 1,
    source: 'x32',
    lastModified: '2024-11-28T19:00:00Z',
    hasLocalBackup: false,
    notes: 'Smaller acoustic setup',
  },
  {
    id: '3',
    name: 'Youth Service',
    index: 2,
    source: 'local',
    lastModified: '2024-11-25T16:00:00Z',
    hasLocalBackup: true,
  },
];

let currentSceneIndex = 0;
let scenesStore = [...mockScenes];
let nextId = 4;

// Track the current fetch mode for debugging
export type FetchMode = 'localhost' | 'docker' | 'mock';
let currentMode: FetchMode = 'mock';
let serverAvailable: boolean | null = null;

export function getCurrentFetchMode(): FetchMode {
  return currentMode;
}

// Reset mock state between tests
export function resetMockState(): void {
  currentSceneIndex = 0;
  scenesStore = [...mockScenes];
  nextId = 4;
}

// Check if localhost server is available (cached)
async function checkServerAvailable(): Promise<boolean> {
  if (serverAvailable !== null) {
    return serverAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    const response = await originalFetch('http://localhost:3001/api/scenes', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    serverAvailable = response.ok;
    if (serverAvailable) {
      currentMode = 'localhost';
    }
    return serverAvailable;
  } catch {
    serverAvailable = false;
    return false;
  }
}

// Mock response handler
function createMockResponse(url: string, options?: RequestInit): Response {
  const method = options?.method || 'GET';
  const urlPath = url.replace(/^https?:\/\/[^/]+/, '');

  // GET /api/scenes
  if (urlPath === '/api/scenes' && method === 'GET') {
    return new Response(JSON.stringify({
      success: true,
      data: {
        scenes: scenesStore,
        currentSceneIndex,
        connectionStatus: 'mock',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST /api/scenes (create)
  if (urlPath === '/api/scenes' && method === 'POST') {
    let body: Record<string, unknown> = {};
    if (options?.body) {
      if (typeof options.body === 'string') {
        body = JSON.parse(options.body);
      }
    }
    const newScene: Scene = {
      id: String(nextId++),
      name: (body.name as string) || 'New Scene',
      index: scenesStore.length,
      source: 'local',
      lastModified: new Date().toISOString(),
      hasLocalBackup: true,
      notes: body.notes as string | undefined,
    };

    // If copying from another scene
    if (body.copyFromId) {
      const sourceScene = scenesStore.find(s => s.id === (body.copyFromId as string));
      if (sourceScene && !body.notes) {
        newScene.notes = sourceScene.notes;
      }
    }

    scenesStore.push(newScene);

    return new Response(JSON.stringify({
      success: true,
      data: newScene,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST /api/scenes/:id/load
  const loadMatch = urlPath.match(/^\/api\/scenes\/([^/]+)\/load$/);
  if (loadMatch && method === 'POST') {
    const sceneId = loadMatch[1];
    const scene = scenesStore.find(s => s.id === sceneId);

    if (scene) {
      currentSceneIndex = scene.index;
      return new Response(JSON.stringify({
        success: true,
        data: { loaded: true },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Scene not found',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // DELETE /api/scenes/:id
  const deleteMatch = urlPath.match(/^\/api\/scenes\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const sceneId = deleteMatch[1];
    const index = scenesStore.findIndex(s => s.id === sceneId);

    if (index !== -1) {
      scenesStore.splice(index, 1);
      return new Response(JSON.stringify({
        success: true,
        data: { deleted: true },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Scene not found',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/scenes/:id
  const getMatch = urlPath.match(/^\/api\/scenes\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    const sceneId = getMatch[1];
    const scene = scenesStore.find(s => s.id === sceneId);

    if (scene) {
      return new Response(JSON.stringify({
        success: true,
        data: scene,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Scene not found',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Default 404
  return new Response(JSON.stringify({
    success: false,
    error: 'Not found',
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Store original fetch before any mocking
const originalFetch = globalThis.fetch;

// Create the fallback fetch function
async function fallbackFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();

  // Convert relative URL to absolute for localhost
  const fullUrl = url.startsWith('/') ? `http://localhost:3001${url}` : url;

  // Check if server is available (only on first call)
  const isServerUp = await checkServerAvailable();

  if (isServerUp) {
    // Use real server
    try {
      return await originalFetch(fullUrl, init);
    } catch {
      // Server failed mid-test, fall back to mock
      currentMode = 'mock';
    }
  }

  // Fall back to mock responses
  currentMode = 'mock';
  return createMockResponse(url, init);
}

// Setup function to install the fallback fetch
export function setupFetchFallback(): void {
  // Reset server availability check for fresh detection
  serverAvailable = null;
  currentMode = 'mock';

  // Install fallback fetch
  globalThis.fetch = vi.fn(fallbackFetch) as typeof fetch;
}

// Teardown function to restore original fetch
export function teardownFetchFallback(): void {
  globalThis.fetch = originalFetch;
  resetMockState();
}
