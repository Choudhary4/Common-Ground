import { io, type Socket } from 'socket.io-client';
import { getSessionToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || undefined;
    const token = getSessionToken();
    socket = io(url, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      autoConnect: true,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
