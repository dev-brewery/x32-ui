/**
 * X32 OSC Protocol Types
 * Based on the unofficial X32/M32 OSC Remote Protocol documentation
 */

export interface X32Config {
  /** X32 IP address */
  ip: string;
  /** X32 OSC port (default: 10023) */
  port: number;
  /** Local port for receiving messages */
  localPort: number;
  /** Enable mock mode for development */
  mockMode: boolean;
}

export interface X32Info {
  /** X32 IP address */
  ip: string;
  /** Console name */
  name: string;
  /** Console model (e.g., "X32", "X32 Rack", "M32") */
  model: string;
  /** Firmware version */
  firmware: string;
}

export interface OSCMessage {
  address: string;
  args: OSCArgument[];
}

export type OSCArgument =
  | { type: 'i'; value: number }  // int32
  | { type: 'f'; value: number }  // float32
  | { type: 's'; value: string }  // string
  | { type: 'b'; value: Uint8Array }; // blob

export interface X32Scene {
  /** Scene slot index (0-99) */
  index: number;
  /** Scene name */
  name: string;
  /** Scene notes */
  notes: string;
}

/**
 * X32 OSC Address patterns for scene management
 */
export const X32_OSC_ADDRESSES = {
  // Console info
  INFO: '/xinfo',
  STATUS: '/status',

  // Scene management
  SCENE_CURRENT: '/-show/prepos/current',
  SCENE_GO: '/-action/goscene',  // Fire-and-forget command to load a scene
  SCENE_NAME: (index: number) => `/-show/showfile/scene/${String(index).padStart(3, '0')}/name`,
  SCENE_NOTES: (index: number) => `/-show/showfile/scene/${String(index).padStart(3, '0')}/notes`,

  // Remote control
  XREMOTE: '/xremote',

  // Show file operations
  SHOW_CURRENT: '/-show/showfile/show/name',
} as const;

/**
 * Default X32 configuration
 */
export const DEFAULT_X32_CONFIG: X32Config = {
  ip: '192.168.0.64',
  port: 10023,
  localPort: 10024,
  mockMode: true, // Default to mock mode for development
};
