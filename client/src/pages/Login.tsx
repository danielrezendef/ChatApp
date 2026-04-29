import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface LoginResponse {
  token: string;
  user: { id: string; email: string; createdAt: string };
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>('/api/auth/login', { email, password });
      login(res.token, res.user);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
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

        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">Bem-vindo de volta!</p>

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
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="auth-link">
          Não tem conta? <Link to="/register">Criar conta</Link>
        </div>
      </div>
    </div>
  );
}
