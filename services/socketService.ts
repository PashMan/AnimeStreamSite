import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io({
        path: '/socket.io',
        transports: ['polling', 'websocket']
      });
    }
    return this.socket;
  }

  joinRoom(roomId: string) {
    this.socket?.emit("join-room", roomId);
  }

  // Used for global chat page
  sendGlobalMessage(message: any) {
    this.socket?.emit("global-message", message);
  }

  // Used for watch together room chat
  sendRoomMessage(roomId: string, message: any) {
      this.socket?.emit("room-message", { ...message, roomId });
  }

  onGlobalMessage(callback: (message: any) => void) {
    this.socket?.on("global-message", callback);
  }

  onRoomMessage(callback: (message: any) => void) {
    this.socket?.on("room-message", callback);
  }

  onWatchSync(callback: (data: any) => void) {
    this.socket?.on("watch-sync", callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
