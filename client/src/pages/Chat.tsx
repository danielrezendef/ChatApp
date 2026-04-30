// RESUMIDO: adicionando realtime completo
// ... mantendo código existente ...

// ADICIONE ESTADOS
const [online, setOnline] = useState<string[]>([]);
const [typing, setTyping] = useState<string | null>(null);

// DENTRO DO SOCKET useEffect
socket.on('presence', setOnline);

socket.on('typing', ({ from }) => {
  if (from === selected?.id) setTyping(from);
});

socket.on('stop_typing', () => setTyping(null));

socket.on('messages_read', () => {
  setMessages(prev => prev.map(m => ({ ...m, readAt: new Date().toISOString() })));
});

// AO SELECIONAR USUÁRIO
useEffect(() => {
  if (!selected || !token) return;
  const socket = getSocket(token);
  socket.emit('read_messages', { from: selected.id });
}, [selected]);

// INPUT CHANGE
const handleInputChange = (e) => {
  setInput(e.target.value);
  const socket = getSocket(token);
  socket.emit('typing', { to: selected?.id });
  setTimeout(() => socket.emit('stop_typing', { to: selected?.id }), 800);
};

// UI STATUS
<div className="chat-header-status">
  {typing ? 'digitando...' : online.includes(selected.id) ? 'online' : 'offline'}
</div>

// CHECK VISUAL
{mine && (
  <span className="msg-check">
    {msg.readAt ? '✔✔' : '✔'}
  </span>
)}

// BOTÃO LIMPAR
<button onClick={() => setMessages([])}>Limpar conversa</button>
