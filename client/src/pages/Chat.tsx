import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { getSocket, disconnectSocket } from '../lib/socket';

interface User {
  id: string;
  email: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  readAt?: string | null;
}

type UnreadMap = Record<string, number>;

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Chat() {
  const { user, token, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [online, setOnline] = useState<string[]>([]);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const [unread, setUnread] = useState<UnreadMap>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const selectedRef = useRef<User | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(console.error);
  }, []);

  useEffect(() => {
    const handleEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && selectedRef.current) {
        setSelected(null);
        setTypingFrom(null);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);

    const onPresence = (ids: string[]) => setOnline(ids);

    const onTyping = ({ from }: { from: string }) => {
      if (selectedRef.current?.id === from) setTypingFrom(from);
    };

    const onStopTyping = ({ from }: { from: string }) => {
      if (selectedRef.current?.id === from) setTypingFrom(null);
    };

    const onMessagesRead = ({ by }: { by: string }) => {
      setMessages(prev =>
        prev.map(m =>
          m.senderId === user?.id && m.receiverId === by
            ? { ...m, readAt: m.readAt || new Date().toISOString() }
            : m
        )
      );
    };

    const onNewMessage = (msg: Message) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      const current = selectedRef.current;
      const isIncoming = msg.receiverId === user?.id && msg.senderId !== user?.id;
      const isCurrentConversation = current?.id === msg.senderId;

      if (current && isCurrentConversation) {
        socket.emit('read_messages', { from: current.id });
        setUnread(prev => ({ ...prev, [current.id]: 0 }));
        return;
      }

      if (isIncoming) {
        setUnread(prev => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));

        const sender = users.find(u => u.id === msg.senderId);
        const senderLabel = sender?.email || 'Nova mensagem';

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(senderLabel, {
            body: msg.content,
            tag: `chat-${msg.senderId}`,
            silent: false,
          });
        }
      }
    };

    socket.on('presence', onPresence);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('messages_read', onMessagesRead);
    socket.on('new_message', onNewMessage);

    return () => {
      socket.off('presence', onPresence);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('messages_read', onMessagesRead);
      socket.off('new_message', onNewMessage);
    };
  }, [token, user?.id, users]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!selected || !token) return;

    setLoadingMsgs(true);
    setTypingFrom(null);
    setUnread(prev => ({ ...prev, [selected.id]: 0 }));

    api.get<Message[]>(`/api/messages/${selected.id}`)
      .then(data => {
        setMessages(data);
        const socket = getSocket(token);
        socket.emit('read_messages', { from: selected.id });
      })
      .catch(console.error)
      .finally(() => setLoadingMsgs(false));
  }, [selected, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingFrom]);

  const clearConversation = async () => {
    if (!selected) return;
    if (!confirm('Deseja realmente apagar esta conversa?')) return;

    try {
      await api.delete<{ ok: boolean }>(`/api/messages/${selected.id}`);
      setUnread(prev => ({ ...prev, [selected.id]: 0 }));
      setMessages(prev =>
        prev.filter(
          m =>
            !(
              (m.senderId === user?.id && m.receiverId === selected.id) ||
              (m.senderId === selected.id && m.receiverId === user?.id)
            )
        )
      );
    } catch (err) {
      console.error(err);
      alert('Não foi possível limpar a conversa.');
    }
  };

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !selected || !token) return;

    const socket = getSocket(token);
    socket.emit('send_message', { receiverId: selected.id, content });
    socket.emit('stop_typing', { to: selected.id });

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, selected, token]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    if (!selected || !token) return;

    const socket = getSocket(token);
    socket.emit('typing', { to: selected.id });

    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socket.emit('stop_typing', { to: selected.id });
    }, 900);
  };

  const messagesByDate: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    if (!selected) return;
    const belongs =
      (msg.senderId === user?.id && msg.receiverId === selected.id) ||
      (msg.senderId === selected.id && msg.receiverId === user?.id);
    if (!belongs) return;

    const date = formatDate(msg.createdAt);
    const last = messagesByDate[messagesByDate.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else messagesByDate.push({ date, messages: [msg] });
  });

  return (
    <div className="app-layout">
      <aside className={`sidebar ${selected ? 'mobile-hidden' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-dot" />
            <span className="sidebar-logo-name">ChatApp</span>
          </div>
        </div>

        <div className="sidebar-me">
          <div className="avatar">{user ? getInitials(user.email) : '?'}</div>
          <div className="sidebar-me-info">
            <div className="sidebar-me-label">Você</div>
            <div className="sidebar-me-email">{user?.email}</div>
          </div>
          <button className="btn-logout" onClick={logout} title="Sair">
            <span>Sair</span>
          </button>
        </div>

        <div className="sidebar-section-title">Conversas</div>

        <div className="users-list">
          {users.length === 0 && (
            <div style={{ padding: '12px', color: 'var(--text-3)', fontSize: 13 }}>
              Nenhum usuário cadastrado.
            </div>
          )}

          {users.map(u => {
            const isOnline = online.includes(u.id);
            const unreadCount = unread[u.id] || 0;

            return (
              <div
                key={u.id}
                className={`user-item ${selected?.id === u.id ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setSelected(u)}
              >
                <div className="avatar avatar-sm avatar-wrap">
                  {getInitials(u.email)}
                  <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
                </div>
                <div className="user-item-info">
                  <div className="user-item-email">{u.email}</div>
                  <div className="user-item-status">{unreadCount > 0 ? 'nova mensagem' : isOnline ? 'online' : 'offline'}</div>
                </div>
                {unreadCount > 0 && <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </div>
            );
          })}
        </div>
      </aside>

      <main className={`chat-area ${selected ? 'mobile-active' : ''}`}>
        {!selected ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <div className="chat-empty-text">Selecione um usuário para conversar</div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <button className="btn-back-mobile" onClick={() => setSelected(null)}>←</button>
              <div className="avatar avatar-sm avatar-wrap">
                {getInitials(selected.email)}
                <span className={`presence-dot ${online.includes(selected.id) ? 'online' : 'offline'}`} />
              </div>
              <div className="chat-header-info">
                <div className="chat-header-email">{selected.email}</div>
                <div className="chat-header-status">
                  {typingFrom === selected.id
                    ? 'digitando...'
                    : online.includes(selected.id)
                      ? 'online'
                      : 'offline'}
                </div>
              </div>
              <button className="btn-clear-chat" onClick={clearConversation} title="Limpar conversa">
                Limpar
              </button>
            </div>

            <div className="messages-container">
              {loadingMsgs && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20 }}>
                  <div className="spinner" />
                </div>
              )}

              {!loadingMsgs && messagesByDate.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, marginTop: 40 }}>
                  Nenhuma mensagem ainda. Diga olá! 👋
                </div>
              )}

              {messagesByDate.map(group => (
                <div key={group.date} className="msg-group">
                  <div className="date-divider"><span>{group.date}</span></div>
                  {group.messages.map(msg => {
                    const mine = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`msg-wrapper ${mine ? 'mine' : 'theirs'}`}>
                        <div className="msg-bubble">
                          {msg.content}
                          <span className="msg-time">
                            {formatTime(msg.createdAt)}
                            {mine && <span className={`msg-check ${msg.readAt ? 'read' : ''}`}>{msg.readAt ? ' ✔✔' : ' ✔'}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {typingFrom === selected.id && (
                <div className="msg-wrapper theirs">
                  <div className="msg-bubble typing-bubble">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <textarea
                ref={textareaRef}
                className="chat-input"
                placeholder="Digite uma mensagem..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button className="btn-send" onClick={sendMessage} disabled={!input.trim()} title="Enviar">
                ➤
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
