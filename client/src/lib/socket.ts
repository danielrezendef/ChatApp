import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

let socketInstance: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    socketRef.current = getSocket(token);
    return () => {};
  }, [token]);

  return socketRef.current;
}
