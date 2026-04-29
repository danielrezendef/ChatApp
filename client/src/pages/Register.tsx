import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface RegisterResponse {
  token: string;
  user: { id: string; email: string; createdAt: string };
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<RegisterResponse>('/api/auth/register', { email, password });
      login(res.token, res.user);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">💬</div>
          <span className="auth-logo-name">ChatApp</span>
        </div>

        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">É rápido e gratuito.</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-link">
          Já tem conta? <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  );
}
