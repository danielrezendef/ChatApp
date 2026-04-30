// ALTERAÇÃO APENAS NA FUNÇÃO CLEAR
// substitua clearConversation por isso:

const clearConversation = async () => {
  if (!selected) return;

  if (!confirm('Deseja realmente apagar esta conversa?')) return;

  try {
    await api.post(`/api/messages/${selected.id}`, {});
    setMessages([]);
  } catch (err) {
    console.error(err);
  }
};

// OBS: restante do arquivo permanece igual
