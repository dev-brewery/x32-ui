/**
 * WebSocket Handler
 * Real-time communication with the frontend
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { x32Connection, type ConnectionState } from '../x32/connection.js';

interface WSMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

export class WebSocketHandler {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WebSocket] Client connected');
      this.clients.add(ws);

      // Send current connection status
      this.sendToClient(ws, {
        type: 'connection_status',
        payload: {
          status: x32Connection.getState(),
          isMockMode: x32Connection.isMockMode(),
        },
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WebSocket] Invalid message:', error);
        }
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
        this.clients.delete(ws);
      });
    });

    // Listen for X32 connection state changes
    x32Connection.on('stateChange', (state: ConnectionState) => {
      this.broadcast({
        type: 'connection_status',
        payload: {
          status: state,
          isMockMode: x32Connection.isMockMode(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Listen for scene loads
    x32Connection.on('sceneLoaded', (sceneIndex: number) => {
      this.broadcast({
        type: 'scene_loaded',
        payload: { sceneIndex },
        timestamp: new Date().toISOString(),
      });
    });

    console.log('[WebSocket] Server initialized');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: { type: string; payload?: unknown }): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          payload: null,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'get_status':
        this.sendToClient(ws, {
          type: 'connection_status',
          payload: {
            status: x32Connection.getState(),
            isMockMode: x32Connection.isMockMode(),
          },
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        console.log('[WebSocket] Unknown message type:', message.type);
    }
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Notify clients that scene list has been updated
   */
  notifySceneListUpdate(): void {
    this.broadcast({
      type: 'scene_list_updated',
      payload: null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify clients of an error
   */
  notifyError(error: string): void {
    this.broadcast({
      type: 'error',
      payload: { message: error },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss?.close();
  }
}

// Singleton instance
export const wsHandler = new WebSocketHandler();
