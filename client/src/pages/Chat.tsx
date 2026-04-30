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

const EMOJIS = ['😀', '😂', '😍', '😎', '😭', '😡', '🙏', '👏', '🔥', '❤️', '👍', '👎', '🎉', '💪', '🤝', '✅', '⚠️', '💬'];

const EMOJI_SHORTCUTS: Record<string, string> = {
  ':smile:': '😀',
  ':joy:': '😂',
  ':love:': '😍',
  ':cool:': '😎',
  ':cry:': '😭',
  ':angry:': '😡',
  ':pray:': '🙏',
  ':clap:': '👏',
  ':fire:': '🔥',
  ':heart:': '❤️',
  ':like:': '👍',
  ':dislike:': '👎',
  ':party:': '🎉',
  ':ok:': '✅',
  ':warn:': '⚠️',
};

const RECENT_EMOJI_KEY = 'chatapp_recent_emojis';
const IMAGE_PREFIX = '[image]';

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

function isImageMessage(content: string) {
  return content.startsWith(IMAGE_PREFIX);
}

function getImageSrc(content: string) {
  return content.replace(IMAGE_PREFIX, '');
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const selectedRef = useRef<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_EMOJI_KEY);
    if (saved) setRecentEmojis(JSON.parse(saved));
  }, []);

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
      if (event.key === 'Escape' && imagePreview) {
        setImagePreview(null);
        return;
      }
      if (event.key === 'Escape' && showEmojiPicker) {
        setShowEmojiPicker(false);
        return;
      }
      if (event.key === 'Escape' && selectedRef.current) {
        setSelected(null);
        setTypingFrom(null);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showEmojiPicker, imagePreview]);

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
      setMessages(prev => prev.map(m => m.senderId === user?.id && m.receiverId === by ? { ...m, readAt: m.readAt || new Date().toISOString() } : m));
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
        setUnread(prev => ({ ...prev, [msg.senderId]: (prev[msg.senderId] || 0) + 1 }));
        const sender = users.find(u => u.id === msg.senderId);
        const senderLabel = sender?.email || 'Nova mensagem';
        const notificationBody = isImageMessage(msg.content) ? '📸 Imagem recebida' : msg.content;

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(senderLabel, { body: notificationBody, tag: `chat-${msg.senderId}`, silent: false });
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

  useEffect(() => () => disconnectSocket(), []);

  useEffect(() => {
    if (!selected || !token) return;

    setLoadingMsgs(true);
    setTypingFrom(null);
    setUnread(prev => ({ ...prev, [selected.id]: 0 }));
    setShowEmojiPicker(false);
    setImagePreview(null);

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
      setMessages(prev => prev.filter(m => !((m.senderId === user?.id && m.receiverId === selected.id) || (m.senderId === selected.id && m.receiverId === user?.id))));
    } catch (err) {
      console.error(err);
      alert('Não foi possível limpar a conversa.');
    }
  };

  const emitTyping = () => {
    if (!selected || !token) return;
    const socket = getSocket(token);
    socket.emit('typing', { to: selected.id });

    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit('stop_typing', { to: selected.id }), 900);
  };

  const saveRecentEmoji = (emoji: string) => {
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 8);
    setRecentEmojis(updated);
    localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(updated));
  };

  const addEmoji = (emoji: string) => {
    setInput(prev => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    saveRecentEmoji(emoji);
    textareaRef.current?.focus();
    emitTyping();
  };

  const replaceEmojiShortcut = (value: string) => {
    return value.replace(/:[a-z]+:/gi, match => EMOJI_SHORTCUTS[match.toLowerCase()] || match);
  };

  const sendRawContent = useCallback((content: string) => {
    if (!content || !selected || !token) return;
    const socket = getSocket(token);
    socket.emit('send_message', { receiverId: selected.id, content });
    socket.emit('stop_typing', { to: selected.id });
  }, [selected, token]);

  const sendMessage = useCallback(() => {
    const content = replaceEmojiShortcut(input.trim());
    if (!content) return;
    sendRawContent(content);
    setInput('');
    setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, sendRawContent]);

  const sendImage = () => {
    if (!imagePreview) return;
    sendRawContent(`${IMAGE_PREFIX}${imagePreview}`);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida.');
      return;
    }
    if (file.size > 1024 * 1024) {
      alert('Selecione uma imagem com até 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = replaceEmojiShortcut(e.target.value);
    setInput(value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    emitTyping();
  };

  const messagesByDate: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    if (!selected) return;
    const belongs = (msg.senderId === user?.id && msg.receiverId === selected.id) || (msg.senderId === selected.id && msg.receiverId === user?.id);
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
          <div className="sidebar-logo"><div className="sidebar-logo-dot" /><span className="sidebar-logo-name">ChatApp</span></div>
        </div>
        <div className="sidebar-me">
          <div className="avatar">{user ? getInitials(user.email) : '?'}</div>
          <div className="sidebar-me-info"><div className="sidebar-me-label">Você</div><div className="sidebar-me-email">{user?.email}</div></div>
          <button className="btn-logout" onClick={logout} title="Sair"><span>Sair</span></button>
        </div>
        <div className="sidebar-section-title">Conversas</div>
        <div className="users-list">
          {users.length === 0 && <div style={{ padding: '12px', color: 'var(--text-3)', fontSize: 13 }}>Nenhum usuário cadastrado.</div>}
          {users.map(u => {
            const isOnline = online.includes(u.id);
            const unreadCount = unread[u.id] || 0;
            return (
              <div key={u.id} className={`user-item ${selected?.id === u.id ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`} onClick={() => setSelected(u)}>
                <div className="avatar avatar-sm avatar-wrap">{getInitials(u.email)}<span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} /></div>
                <div className="user-item-info"><div className="user-item-email">{u.email}</div><div className="user-item-status">{unreadCount > 0 ? 'nova mensagem' : isOnline ? 'online' : 'offline'}</div></div>
                {unreadCount > 0 && <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </div>
            );
          })}
        </div>
      </aside>

      <main className={`chat-area ${selected ? 'mobile-active' : ''}`}>
        {!selected ? <div className="chat-empty"><div className="chat-empty-icon">💬</div><div className="chat-empty-text">Selecione um usuário para conversar</div></div> : (
          <>
            <div className="chat-header">
              <button className="btn-back-mobile" onClick={() => setSelected(null)}>←</button>
              <div className="avatar avatar-sm avatar-wrap">{getInitials(selected.email)}<span className={`presence-dot ${online.includes(selected.id) ? 'online' : 'offline'}`} /></div>
              <div className="chat-header-info"><div className="chat-header-email">{selected.email}</div><div className="chat-header-status">{typingFrom === selected.id ? 'digitando...' : online.includes(selected.id) ? 'online' : 'offline'}</div></div>
              <button className="btn-clear-chat" onClick={clearConversation} title="Limpar conversa">Limpar</button>
            </div>

            <div className="messages-container">
              {loadingMsgs && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20 }}><div className="spinner" /></div>}
              {!loadingMsgs && messagesByDate.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, marginTop: 40 }}>Nenhuma mensagem ainda. Diga olá! 👋</div>}
              {messagesByDate.map(group => <div key={group.date} className="msg-group"><div className="date-divider"><span>{group.date}</span></div>{group.messages.map(msg => {
                const mine = msg.senderId === user?.id;
                return <div key={msg.id} className={`msg-wrapper ${mine ? 'mine' : 'theirs'}`}><div className="msg-bubble">{isImageMessage(msg.content) ? <img className="chat-image" src={getImageSrc(msg.content)} alt="Imagem enviada" /> : msg.content}<span className="msg-time">{formatTime(msg.createdAt)}{mine && <span className={`msg-check ${msg.readAt ? 'read' : ''}`}>{msg.readAt ? ' ✔✔' : ' ✔'}</span>}</span></div></div>;
              })}</div>)}
              {typingFrom === selected.id && <div className="msg-wrapper theirs"><div className="msg-bubble typing-bubble"><span></span><span></span><span></span></div></div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              {imagePreview && <div className="image-preview"><img src={imagePreview} alt="Prévia" /><button onClick={() => setImagePreview(null)}>×</button><button onClick={sendImage}>Enviar imagem</button></div>}
              <div className="emoji-wrapper">
                <button type="button" className="btn-emoji" onClick={() => setShowEmojiPicker(prev => !prev)} title="Emojis">🙂</button>
                {showEmojiPicker && <div className="emoji-picker">{recentEmojis.length > 0 && <div className="emoji-section-title">Recentes</div>}{recentEmojis.map(emoji => <button key={`recent-${emoji}`} type="button" onClick={() => addEmoji(emoji)}>{emoji}</button>)}<div className="emoji-section-title">Todos</div>{EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>{emoji}</button>)}<div className="emoji-help">Use também: :smile: :fire: :heart:</div></div>}
              </div>
              <button type="button" className="btn-attach" onClick={() => fileInputRef.current?.click()} title="Enviar imagem">📎</button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageSelect} />
              <textarea ref={textareaRef} className="chat-input" placeholder="Digite uma mensagem... use :smile:" value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={1} />
              <button className="btn-send" onClick={sendMessage} disabled={!input.trim()} title="Enviar">➤</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
