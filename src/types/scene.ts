/**
 * Scene data structure for X32 Scene Manager
 */

export interface Scene {
  /** Unique identifier */
  id: string;
  /** Display name of the scene */
  name: string;
  /** X32 scene slot index (0-99) */
  index: number;
  /** Where the scene is stored */
  source: 'x32' | 'local' | 'both';
  /** Last modification timestamp */
  lastModified: string;
  /** Whether a local .scn backup exists */
  hasLocalBackup: boolean;
  /** Optional notes about the scene */
  notes?: string;
}

export interface SceneListResponse {
  scenes: Scene[];
  currentSceneIndex: number | null;
  connectionStatus: ConnectionStatus;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'mock';

export interface X32Info {
  ip: string;
  name: string;
  model: string;
  firmware: string;
}

export interface LoadSceneRequest {
  sceneId: string;
}

export interface SaveSceneRequest {
  name: string;
  notes?: string;
  /** If provided, save to specific slot; otherwise auto-assign */
  slotIndex?: number;
}

export interface CreateSceneRequest {
  name: string;
  notes?: string;
  /** Copy from existing scene ID */
  copyFromId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** WebSocket message types */
export type WSMessageType =
  | 'connection_status'
  | 'scene_loaded'
  | 'scene_saved'
  | 'scene_deleted'
  | 'scene_list_updated'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: string;
}
