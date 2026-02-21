import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(window.location.origin);
    }
    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  joinRoom(roomId: string) {
    this.socket?.emit("join-room", roomId);
  }

  sendGlobalMessage(message: any) {
    this.socket?.emit("send-global-message", message);
  }

  onGlobalMessage(callback: (message: any) => void) {
    this.socket?.on("global-message", callback);
  }

  syncWatch(data: { roomId: string; action: string; time: number; userId: string }) {
    this.socket?.emit("watch-sync", data);
  }

  onWatchSync(callback: (data: any) => void) {
    this.socket?.on("watch-sync", callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
