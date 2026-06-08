import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';

interface RoomClient {
  clientId: string;
  ws: WebSocket;
  name: string;
  avatar: string;
  isMuted: boolean;
  joinedAt: number;
}

interface Room {
  id: string;
  clients: Map<string, RoomClient>;
  playerState: {
    isPlaying: boolean;
    time: number;
    episode?: string;
    kodikVideo?: any;
    nativeAudioTrack?: number;
    updatedAt: number;
  };
}

const rooms = new Map<string, Room>();

export function setupWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
    const { pathname } = parse(request.url || '', true);

    if (pathname === '/ws/room') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const { query } = parse(request.url || '', true);
    const roomId = query.roomId as string;
    const clientId = query.clientId as string || Math.random().toString(36).substring(2, 9);
    const name = query.name as string || 'Guest';
    const avatar = query.avatar as string || '';

    if (!roomId) {
      ws.close(1008, 'Room ID required');
      return;
    }

    console.log(`[WS] Client ${clientId} (${name}) connecting to room ${roomId}`);

    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        clients: new Map(),
        playerState: {
          isPlaying: false,
          time: 0,
          updatedAt: Date.now()
        }
      };
      rooms.set(roomId, room);
    }

    const client: RoomClient = {
      clientId,
      ws,
      name,
      avatar,
      isMuted: true, // Default to muted for safety
      joinedAt: Date.now()
    };

    room.clients.set(clientId, client);

    const getHostClientId = (r: Room) => {
      const clientsSorted = Array.from(r.clients.values()).sort((a, b) => a.joinedAt - b.joinedAt);
      return clientsSorted[0]?.clientId;
    };

    // Send successful join info
    const sendJson = (targetWs: WebSocket, obj: any) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify(obj));
      }
    };

    // Helper to broadcast to room
    const broadcastToRoom = (msg: any, excludeClientId?: string) => {
      if (!room) return;
      const msgStr = JSON.stringify(msg);
      room.clients.forEach((c) => {
        if (c.clientId !== excludeClientId && c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(msgStr);
        }
      });
    };

    // Get current client list (excluding sensitive ws object)
    const getClientList = () => {
      if (!room) return [];
      const currentHostId = getHostClientId(room);
      return Array.from(room.clients.values()).map(c => ({
        clientId: c.clientId,
        name: c.name,
        avatar: c.avatar,
        isMuted: c.isMuted,
        isHost: c.clientId === currentHostId
      }));
    };

    const hostClientId = getHostClientId(room);

    // 1. Send initialization data back to joining user
    sendJson(ws, {
      type: 'init-state',
      clientId,
      role: clientId === hostClientId ? 'host' : 'viewer',
      users: getClientList(),
      playerState: room.playerState
    });

    // 2. Broadcast updated user list to everyone in the room
    broadcastToRoom({
      type: 'room-users-updated',
      users: getClientList()
    });

    // Listen for client messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        switch (data.type) {
          case 'player-state-update': {
            if (!room) return;
            // Update the authoritative player state on the server
            room.playerState = {
              isPlaying: data.isPlaying,
              time: data.time,
              episode: data.episode,
              kodikVideo: data.kodikVideo,
              nativeAudioTrack: data.nativeAudioTrack,
              updatedAt: Date.now()
            };

            // Broadcast player state to other peers in room
            broadcastToRoom({
              type: 'player-state-broadcast',
              senderId: clientId,
              ...room.playerState
            }, clientId);
            break;
          }

          case 'webrtc-signal': {
            if (!room) return;
            const targetClient = room.clients.get(data.targetId);
            if (targetClient) {
              sendJson(targetClient.ws, {
                type: 'webrtc-signal-relay',
                senderId: clientId,
                signal: data.signal
              });
            }
            break;
          }

          case 'voice-state-update': {
            if (!room) return;
            client.isMuted = !!data.isMuted;
            
            broadcastToRoom({
              type: 'room-users-updated',
              users: getClientList()
            });
            break;
          }
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      if (!room) return;
      console.log(`[WS] Client ${clientId} disconnected from room ${roomId}`);
      room.clients.delete(clientId);

      if (room.clients.size === 0) {
        rooms.delete(roomId);
        console.log(`[WS] Room ${roomId} is empty and was destroyed`);
      } else {
        const remainingClients = Array.from(room.clients.values()).sort((a, b) => a.joinedAt - b.joinedAt);
        const newHostId = remainingClients[0]?.clientId;

        // Inform the new host if their role changed to host
        const newHost = remainingClients[0];
        if (newHost && newHostId !== hostClientId) {
          sendJson(newHost.ws, {
            type: 'role-change',
            role: 'host'
          });
        }

        // Send updated user list to remaining users
        broadcastToRoom({
          type: 'room-users-updated',
          users: getClientList()
        });
      }
    });

    ws.on('error', (err) => {
      console.warn(`[WS] Error on client ${clientId} socket:`, err.message);
    });
  });
}
