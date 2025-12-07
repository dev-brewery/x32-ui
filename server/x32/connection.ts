/**
 * X32 Connection Manager
 * Handles OSC communication with the X32 mixer
 * Supports both real hardware and mock mode for development
 */

import osc from 'osc';
import { EventEmitter } from 'events';
import type { X32Config, X32Info, OSCMessage, X32Scene } from './types.js';
import { DEFAULT_X32_CONFIG, X32_OSC_ADDRESSES } from './types.js';
import { createOSCMessage, formatOSCMessage, getStringArg, getIntArg } from './osc-utils.js';
import { mockX32 } from './mock-x32.js';
import { pingX32 } from './discovery.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'mock';

// Scene query configuration
const SCENE_QUERY_BATCH_SIZE = 10; // Number of parallel scene queries
const SCENE_QUERY_TIMEOUT = 1000; // Timeout for individual scene query (ms)
const MAX_SCENES = 100; // X32 supports 100 scene slots (0-99)

export interface X32ConnectionEvents {
  'stateChange': (state: ConnectionState) => void;
  'message': (message: OSCMessage) => void;
  'error': (error: Error) => void;
  'sceneLoaded': (sceneIndex: number) => void;
}

export class X32Connection extends EventEmitter {
  private config: X32Config;
  private state: ConnectionState = 'disconnected';
  private udpPort: osc.UDPPort | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private responseHandlers: Map<string, {
    resolve: (msg: OSCMessage | null) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: Partial<X32Config> = {}) {
    super();
    this.config = { ...DEFAULT_X32_CONFIG, ...config };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current configuration
   */
  getConfig(): X32Config {
    return { ...this.config };
  }

  /**
   * Check if in mock mode
   */
  isMockMode(): boolean {
    return this.config.mockMode;
  }

  /**
   * Connect to X32 (or enter mock mode)
   */
  async connect(): Promise<void> {
    if (this.config.mockMode) {
      console.log('[X32Connection] Starting in mock mode');
      this.setState('mock');
      return;
    }

    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    try {
      // First, verify the X32 is reachable
      console.log(`[X32Connection] Verifying X32 at ${this.config.ip}:${this.config.port}...`);
      const pingResult = await pingX32(this.config.ip, this.config.port);

      if (!pingResult) {
        throw new Error(`X32 not reachable at ${this.config.ip}:${this.config.port}`);
      }

      console.log(`[X32Connection] Found X32: ${pingResult.name} (${pingResult.model})`);

      await this.initializeUDP();
      this.startKeepAlive();
      this.setState('connected');
      console.log(`[X32Connection] Connected to X32 at ${this.config.ip}:${this.config.port}`);
    } catch (error) {
      this.setState('disconnected');
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Disconnect from X32
   */
  disconnect(): void {
    this.stopKeepAlive();
    this.stopReconnect();

    // Clear any pending response handlers
    for (const [, handler] of this.responseHandlers) {
      clearTimeout(handler.timeout);
      handler.resolve(null);
    }
    this.responseHandlers.clear();

    if (this.udpPort) {
      try {
        this.udpPort.close();
      } catch {
        // Ignore close errors
      }
      this.udpPort = null;
    }

    this.setState('disconnected');
    console.log('[X32Connection] Disconnected');
  }

  /**
   * Send an OSC message to X32 and wait for response
   */
  async send(message: OSCMessage, timeout: number = 5000): Promise<OSCMessage | null> {
    const logEnabled = !message.address.includes('/xremote');
    if (logEnabled) {
      console.log(`[X32Connection] Sending: ${formatOSCMessage(message)}`);
    }

    if (this.config.mockMode) {
      return mockX32.handleMessage(message);
    }

    if (!this.udpPort || this.state !== 'connected') {
      throw new Error('Not connected to X32');
    }

    return new Promise((resolve, reject) => {
      const requestId = `${message.address}-${Date.now()}-${Math.random()}`;
      const timeoutHandle = setTimeout(() => {
        this.responseHandlers.delete(requestId);
        // For scene queries, return null instead of rejecting
        if (message.address.includes('/-show/showfile/scene/')) {
          resolve(null);
        } else {
          reject(new Error(`OSC request timeout: ${message.address}`));
        }
      }, timeout);

      // Set up response handler
      this.responseHandlers.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timeoutHandle);
          this.responseHandlers.delete(requestId);
          resolve(msg);
        },
        timeout: timeoutHandle,
      });

      // Set up one-time listener for this specific response
      const handler = (oscMessage: osc.OSCMessage) => {
        if (oscMessage.address === message.address) {
          const pending = this.responseHandlers.get(requestId);
          if (pending) {
            this.udpPort?.off('message', handler as Parameters<typeof this.udpPort.off>[1]);
            pending.resolve(this.convertOSCMessage(oscMessage));
          }
        }
      };

      this.udpPort!.on('message', handler);

      try {
        this.udpPort!.send({
          address: message.address,
          args: message.args.map(arg => arg.value),
        }, this.config.ip, this.config.port);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.responseHandlers.delete(requestId);
        this.udpPort!.off('message', handler as Parameters<typeof this.udpPort.off>[1]);
        reject(error);
      }
    });
  }

  /**
   * Send an OSC message without waiting for response (fire-and-forget)
   */
  sendNoWait(message: OSCMessage): void {
    if (this.config.mockMode) {
      mockX32.handleMessage(message);
      return;
    }

    if (!this.udpPort || this.state !== 'connected') {
      return;
    }

    try {
      this.udpPort.send({
        address: message.address,
        args: message.args.map(arg => arg.value),
      }, this.config.ip, this.config.port);
    } catch {
      // Ignore send errors for fire-and-forget
    }
  }

  /**
   * Get X32 console info
   */
  async getInfo(): Promise<X32Info | null> {
    if (this.config.mockMode) {
      return mockX32.getInfo();
    }

    try {
      const message = createOSCMessage(X32_OSC_ADDRESSES.INFO);
      const response = await this.send(message);

      if (response && response.args.length >= 4) {
        return {
          ip: getStringArg(response.args, 0) || '',
          name: getStringArg(response.args, 1) || '',
          model: getStringArg(response.args, 2) || '',
          firmware: getStringArg(response.args, 3) || '',
        };
      }
    } catch (error) {
      console.error('[X32Connection] Failed to get info:', error);
    }

    return null;
  }

  /**
   * Get current scene index
   */
  async getCurrentSceneIndex(): Promise<number> {
    if (this.config.mockMode) {
      return mockX32.getCurrentSceneIndex();
    }

    try {
      const message = createOSCMessage(X32_OSC_ADDRESSES.SCENE_CURRENT);
      const response = await this.send(message);

      if (response) {
        return getIntArg(response.args, 0) ?? -1;
      }
    } catch (error) {
      console.error('[X32Connection] Failed to get current scene:', error);
    }

    return -1;
  }

  /**
   * Load a scene by index
   * Note: This actually changes the mixer state!
   * Uses /-action/goscene which is fire-and-forget (no response expected)
   */
  async loadScene(index: number): Promise<boolean> {
    if (this.config.mockMode) {
      const success = mockX32.setCurrentScene(index);
      if (success) {
        this.emit('sceneLoaded', index);
      }
      return success;
    }

    // Validate index
    if (index < 0 || index >= MAX_SCENES) {
      throw new Error(`Invalid scene index: ${index}. Must be 0-${MAX_SCENES - 1}`);
    }

    // Use /-action/goscene which actually loads the scene
    // This is a fire-and-forget command - no response expected
    const message: OSCMessage = {
      address: X32_OSC_ADDRESSES.SCENE_GO,
      args: [{ type: 'i', value: index }],
    };

    console.log(`[X32Connection] Loading scene ${index}`);
    this.sendNoWait(message);
    this.emit('sceneLoaded', index);
    return true;
  }

  /**
   * Get all scenes from X32 (optimized with parallel queries)
   */
  async getScenes(): Promise<X32Scene[]> {
    if (this.config.mockMode) {
      return mockX32.getScenes();
    }

    console.log('[X32Connection] Fetching scenes from X32...');
    const startTime = Date.now();
    const scenes: X32Scene[] = [];

    // Query scenes in parallel batches for better performance
    for (let batchStart = 0; batchStart < MAX_SCENES; batchStart += SCENE_QUERY_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + SCENE_QUERY_BATCH_SIZE, MAX_SCENES);
      const batchPromises: Promise<X32Scene | null>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(this.getSceneAt(i));
      }

      const batchResults = await Promise.all(batchPromises);

      for (const scene of batchResults) {
        if (scene) {
          scenes.push(scene);
        }
      }

      // Small delay between batches to avoid overwhelming the X32
      if (batchEnd < MAX_SCENES) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[X32Connection] Fetched ${scenes.length} scenes in ${elapsed}ms`);

    return scenes;
  }

  /**
   * Get a single scene by index
   */
  async getSceneAt(index: number): Promise<X32Scene | null> {
    if (this.config.mockMode) {
      const scenes = mockX32.getScenes();
      return scenes.find(s => s.index === index) || null;
    }

    try {
      const nameMessage = createOSCMessage(X32_OSC_ADDRESSES.SCENE_NAME(index));
      const nameResponse = await this.send(nameMessage, SCENE_QUERY_TIMEOUT);
      const name = getStringArg(nameResponse?.args || [], 0);

      // Empty scene slot
      if (!name) {
        return null;
      }

      // Get notes for this scene
      const notesMessage = createOSCMessage(X32_OSC_ADDRESSES.SCENE_NOTES(index));
      const notesResponse = await this.send(notesMessage, SCENE_QUERY_TIMEOUT);
      const notes = getStringArg(notesResponse?.args || [], 0) || '';

      return { index, name, notes };
    } catch {
      // Timeout or error - scene slot is likely empty
      return null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<X32Config>): void {
    const wasConnected = this.state === 'connected';
    const wasMockMode = this.config.mockMode;

    this.config = { ...this.config, ...config };

    // If switching modes or IP changed while connected, reconnect
    if (wasConnected || wasMockMode !== this.config.mockMode) {
      this.disconnect();
      // Don't auto-reconnect - let caller decide
    }
  }

  // Private methods

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }

  private async initializeUDP(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.udpPort = new osc.UDPPort({
        localAddress: '0.0.0.0',
        localPort: this.config.localPort,
        remoteAddress: this.config.ip,
        remotePort: this.config.port,
      });

      // Increase listener limit for parallel queries
      this.udpPort.setMaxListeners(200);

      this.udpPort.on('ready', () => {
        resolve();
      });

      this.udpPort.on('error', (error: Error) => {
        this.emit('error', error);
        reject(error);
      });

      this.udpPort.on('message', (oscMessage: { address: string; args: unknown[] }) => {
        const message = this.convertOSCMessage(oscMessage);
        this.emit('message', message);
      });

      this.udpPort.open();
    });
  }

  private convertOSCMessage(oscMessage: { address: string; args: unknown[] }): OSCMessage {
    return {
      address: oscMessage.address,
      args: oscMessage.args.map(arg => {
        if (typeof arg === 'string') return { type: 's' as const, value: arg };
        if (typeof arg === 'number') {
          if (Number.isInteger(arg)) return { type: 'i' as const, value: arg };
          return { type: 'f' as const, value: arg };
        }
        if (arg instanceof Uint8Array) return { type: 'b' as const, value: arg };
        return { type: 's' as const, value: String(arg) };
      }),
    };
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();

    // X32 requires /xremote every 10 seconds to maintain connection
    this.keepAliveInterval = setInterval(() => {
      if (this.state === 'connected' && this.udpPort) {
        this.sendNoWait({
          address: X32_OSC_ADDRESSES.XREMOTE,
          args: [],
        });
      }
    }, 9000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private stopReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Singleton instance
export const x32Connection = new X32Connection();
