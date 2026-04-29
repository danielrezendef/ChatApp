# ChatApp 💬

App de mensagens privadas em tempo real — React + Node.js + MySQL + Socket.IO.

## Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **ORM**: Prisma
- **Banco**: MySQL
- **Auth**: JWT + bcryptjs
- **Realtime**: Socket.IO
- **Deploy**: Railway

---

## Estrutura do projeto

```
chatapp/
├── client/          # React + Vite frontend
│   └── src/
│       ├── pages/   # Login, Register, Chat
│       ├── hooks/   # useAuth context
│       └── lib/     # api.ts, socket.ts
├── server/          # Node.js + Express backend
│   ├── src/
│   │   ├── routes/  # auth, users, messages
│   │   ├── middleware/ # JWT auth
│   │   └── lib/     # prisma, socket setup
│   └── prisma/
│       └── schema.prisma
├── railway.toml
└── nixpacks.toml
```

---

## Rodar localmente

### 1. Pré-requisitos

- Node.js 20+
- MySQL rodando localmente (ou Docker)

### 2. Clonar e instalar

```bash
git clone <repo>
cd chatapp
npm install
```

### 3. Configurar variáveis de ambiente

Crie o arquivo `server/.env` baseado no exemplo:

```bash
cp server/.env.example server/.env
```

Edite `server/.env`:

```env
DATABASE_URL="mysql://SEU_USUARIO:SUA_SENHA@localhost:3306/chatapp"
JWT_SECRET="coloque-uma-string-longa-e-aleatoria-aqui"
PORT=3000
NODE_ENV=development
```

> **DATABASE_URL**: formato `mysql://user:password@host:port/database`
> **JWT_SECRET**: qualquer string longa e secreta, ex: `openssl rand -hex 32`

### 4. Criar banco e rodar migrations

```bash
# Criar banco no MySQL primeiro:
# CREATE DATABASE chatapp;

# Rodar migrations e gerar client Prisma:
cd server
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

### 5. Rodar em desenvolvimento

```bash
# Na raiz do projeto (roda frontend e backend juntos):
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

O Vite faz proxy automático de `/api` e `/socket.io` para o backend.

---

## Deploy no Railway

### 1. Criar conta e instalar CLI (opcional)

Acesse [railway.app](https://railway.app) e crie uma conta.

### 2. Criar projeto no Railway

No dashboard do Railway:
1. Clique em **New Project**
2. Selecione **Deploy from GitHub repo** (faça push do código primeiro)
   - ou **Empty project** para deploy via CLI

### 3. Adicionar banco MySQL

1. No projeto, clique em **+ New** → **Database** → **MySQL**
2. Aguarde o banco ser criado
3. Clique no banco → aba **Connect**
4. Copie a **DATABASE_URL** no formato `mysql://...`

### 4. Configurar variáveis de ambiente

No serviço do app (não no banco), vá em **Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | Cole a URL do MySQL copiada no passo anterior |
| `JWT_SECRET` | String longa e aleatória (ex: `abc123xyz...`) |
| `NODE_ENV` | `production` |
| `PORT` | Deixe em branco — Railway define automaticamente |

> ⚠️ **Onde alterar DATABASE_URL e JWT_SECRET**:
> No painel do Railway → seu serviço → aba **Variables**.
> Nunca commite o `.env` no repositório.

### 5. Fazer deploy

```bash
# Via CLI do Railway:
railway login
railway link  # vincula ao projeto
railway up
```

Ou simplesmente dê push no GitHub — Railway detecta e faz deploy automático.

### 6. Acompanhar deploy

No painel: **Deployments** → clique no deploy ativo → veja os logs.

O processo faz automaticamente:
1. `npm install`
2. Gera Prisma client
3. Build do frontend e backend
4. `prisma migrate deploy` (cria as tabelas)
5. `node dist/index.js`

### 7. Acessar o app

Após deploy, vá em **Settings** → **Networking** → **Generate Domain**.
O Railway fornece uma URL pública tipo `chatapp-production.up.railway.app`.

---

## Variáveis de ambiente — resumo

| Variável | Onde | Descrição |
|----------|------|-----------|
| `DATABASE_URL` | Railway Variables | URL de conexão MySQL |
| `JWT_SECRET` | Railway Variables | Chave secreta para tokens JWT |
| `PORT` | Railway (automático) | Porta do servidor |
| `NODE_ENV` | Railway Variables | `production` em produção |

---

## Comandos úteis

```bash
# Gerar Prisma client
npm run db:generate --workspace=server

# Rodar migrations em desenvolvimento
npm run db:migrate --workspace=server  # usa migrate deploy
# ou para dev com histórico:
cd server && npx prisma migrate dev

# Prisma Studio (visualizar banco)
cd server && npx prisma studio

# Build completo
npm run build

# Rodar em produção local
npm run start
```

---

## Funcionalidades

- ✅ Cadastro com e-mail e senha (bcrypt)
- ✅ Login com JWT (7 dias)
- ✅ Lista de usuários cadastrados
- ✅ Chat privado em tempo real (Socket.IO)
- ✅ Histórico de mensagens salvo no banco
- ✅ Mensagens alinhadas (direita/esquerda)
- ✅ Data/hora nas mensagens
- ✅ Rotas protegidas com JWT
- ✅ Responsivo (mobile-friendly)
- ✅ Pronto para deploy no Railway
