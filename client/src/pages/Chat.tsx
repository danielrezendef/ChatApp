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
}

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load users list
  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(console.error);
  }, []);

  // Socket setup
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.off('new_message');
    };
  }, [token]);

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  // Load messages when selecting a user
  useEffect(() => {
    if (!selected) return;
    setLoadingMsgs(true);
    api.get<Message[]>(`/api/messages/${selected.id}`)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoadingMsgs(false));
  }, [selected]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !selected || !token) return;

    const socket = getSocket(token);
    socket.emit('send_message', { receiverId: selected.id, content });
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
  };

  // Group messages by date
  const messagesByDate: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.createdAt);
    const last = messagesByDate[messagesByDate.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      messagesByDate.push({ date, messages: [msg] });
    }
  });

  // Filter messages for selected conversation
  const filteredGroups = selected
    ? messagesByDate.map(g => ({
        ...g,
        messages: g.messages.filter(
          m =>
            (m.senderId === user?.id && m.receiverId === selected.id) ||
            (m.senderId === selected.id && m.receiverId === user?.id)
        ),
      })).filter(g => g.messages.length > 0)
    : [];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-dot" />
            <span className="sidebar-logo-name">ChatApp</span>
          </div>
        </div>

        <div className="sidebar-me">
          <div className="avatar">
            {user ? getInitials(user.email) : '?'}
          </div>
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
            <div style={{ padding: '12px 12px', color: 'var(--text-3)', fontSize: 13 }}>
              Nenhum usuário cadastrado.
            </div>
          )}
          {users.map(u => (
            <div
              key={u.id}
              className={`user-item ${selected?.id === u.id ? 'active' : ''}`}
              onClick={() => setSelected(u)}
            >
              <div className="avatar avatar-sm">{getInitials(u.email)}</div>
              <div className="user-item-info">
                <div className="user-item-email">{u.email}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <main className="chat-area">
        {!selected ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <div className="chat-empty-text">Selecione um usuário para conversar</div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="avatar avatar-sm">{getInitials(selected.email)}</div>
              <div className="chat-header-info">
                <div className="chat-header-email">{selected.email}</div>
                <div className="chat-header-status">online</div>
              </div>
            </div>

            <div className="messages-container">
              {loadingMsgs && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20 }}>
                  <div className="spinner" />
                </div>
              )}

              {!loadingMsgs && filteredGroups.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, marginTop: 40 }}>
                  Nenhuma mensagem ainda. Diga olá! 👋
                </div>
              )}

              {filteredGroups.map(group => (
                <div key={group.date} className="msg-group">
                  <div className="date-divider"><span>{group.date}</span></div>
                  {group.messages.map(msg => {
                    const mine = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`msg-wrapper ${mine ? 'mine' : 'theirs'}`}>
                        <div className="msg-bubble">
                          {msg.content}
                          <span className="msg-time">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

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
              <button
                className="btn-send"
                onClick={sendMessage}
                disabled={!input.trim()}
                title="Enviar"
              >
                ➤
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
