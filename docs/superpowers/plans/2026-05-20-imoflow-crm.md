# ImoFlow CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o ImoFlow CRM — SaaS multi-tenant para agências imobiliárias, com login, gestão de leads, pipeline kanban e envio de emails.

**Architecture:** Next.js App Router com Supabase para autenticação e base de dados PostgreSQL. Row Level Security garante isolamento total entre agências. Emails enviados via Resend API.

**Tech Stack:** Next.js 16 / React 19 (App Router), Supabase (Auth + PostgreSQL + RLS), Resend (email), Vercel (hosting), Tailwind CSS v4, @dnd-kit/core (drag-and-drop pipeline). **Nota:** Next.js 15+ — `params` em route handlers é `Promise<{id: string}>`, usar `const { id } = await params`.

---

## Estrutura de Ficheiros

```
imoflow/
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── login/page.tsx              # Página de login
│   ├── dashboard/page.tsx          # Dashboard principal
│   ├── leads/
│   │   ├── page.tsx                # Lista de leads
│   │   └── [id]/page.tsx           # Perfil de lead
│   ├── pipeline/page.tsx           # Kanban pipeline
│   ├── admin/page.tsx              # Painel super admin
│   └── api/
│       ├── leads/route.ts          # CRUD leads
│       ├── contacts/route.ts       # CRUD histórico
│       ├── tasks/route.ts          # CRUD tarefas
│       ├── emails/send/route.ts    # Envio de email via Resend
│       └── admin/agencies/route.ts # Criar agências (super admin)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Sidebar de navegação
│   │   └── Topbar.tsx              # Topbar com título e ações
│   ├── leads/
│   │   ├── LeadsTable.tsx          # Tabela de leads
│   │   ├── LeadCard.tsx            # Card no pipeline
│   │   ├── NewLeadModal.tsx        # Modal criar lead
│   │   └── SendEmailModal.tsx      # Modal enviar email
│   ├── pipeline/
│   │   └── KanbanBoard.tsx         # Board drag-and-drop
│   └── dashboard/
│       ├── StatCard.tsx            # Card de métrica
│       └── ActivityFeed.tsx        # Feed de atividade
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase browser client
│   │   ├── server.ts               # Supabase server client
│   │   └── middleware.ts           # Auth middleware
│   └── resend.ts                   # Resend client
├── types/
│   └── index.ts                    # Tipos TypeScript (Agency, Lead, Contact, Task)
├── middleware.ts                   # Protecção de rotas
└── supabase/
    └── migrations/
        └── 001_initial.sql         # Schema completo
```

---

## Task 1: Setup do Projecto

**Files:**
- Create: `imoflow/` (directório raiz do projecto)
- Create: `imoflow/package.json`
- Create: `imoflow/.env.local`

- [ ] **Step 1: Criar projecto Next.js**

```bash
cd /Users/tomassampaio/Desktop
npx create-next-app@latest imoflow \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd imoflow
```

- [ ] **Step 2: Instalar dependências**

```bash
npm install @supabase/supabase-js @supabase/ssr resend @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 3: Criar ficheiro de variáveis de ambiente**

Criar `imoflow/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
SUPER_ADMIN_EMAIL=tomas@satus.pt
```

- [ ] **Step 4: Criar conta Supabase e obter credenciais**

1. Ir a supabase.com → New Project
2. Copiar Project URL e anon key para `.env.local`
3. Copiar Service Role key (Settings → API) para `.env.local`

- [ ] **Step 5: Criar conta Resend e obter API key**

1. Ir a resend.com → Create API Key
2. Copiar para `.env.local`

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: initial Next.js project setup with dependencies"
```

---

## Task 2: Schema da Base de Dados

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Criar ficheiro de migração**

Criar `supabase/migrations/001_initial.sql`:

```sql
-- AGENCIES
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  logo_url text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- USERS (perfil ligado ao auth.users do Supabase)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'admin',
  avatar_initials text not null default 'XX'
);

-- LEADS
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  stage text not null default 'lead',
  score int not null default 50,
  source text not null default 'outro',
  budget numeric,
  zone text,
  typology text,
  notes text,
  created_at timestamptz not null default now()
);

-- CONTACTS (histórico de interações)
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  type text not null default 'nota',
  title text not null,
  description text,
  note text,
  created_at timestamptz not null default now()
);

-- TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- EMAILS_SENT
create table public.emails_sent (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sent_by uuid references public.users(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

-- ROW LEVEL SECURITY
alter table public.agencies enable row level security;
alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.emails_sent enable row level security;

-- Função helper para obter agency_id do utilizador autenticado
create or replace function public.get_my_agency_id()
returns uuid
language sql stable
as $$
  select agency_id from public.users where id = auth.uid()
$$;

-- POLICIES: users só vêem dados da sua agência
create policy "users: own agency" on public.users
  for all using (agency_id = public.get_my_agency_id());

create policy "leads: own agency" on public.leads
  for all using (agency_id = public.get_my_agency_id());

create policy "contacts: own agency" on public.contacts
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );

create policy "tasks: own agency" on public.tasks
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );

create policy "emails_sent: own agency" on public.emails_sent
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );

-- agencies: apenas service_role pode criar (via admin panel)
create policy "agencies: read own" on public.agencies
  for select using (id = public.get_my_agency_id());
```

- [ ] **Step 2: Executar migração no Supabase**

1. Ir a Supabase Dashboard → SQL Editor
2. Colar o conteúdo do ficheiro e executar
3. Verificar que as 6 tabelas aparecem em Table Editor

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_initial.sql
git commit -m "feat: database schema with RLS multi-tenant isolation"
```

---

## Task 3: Clientes Supabase e Tipos TypeScript

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/resend.ts`
- Create: `types/index.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Criar tipos TypeScript**

Criar `types/index.ts`:

```typescript
export type Agency = {
  id: string
  name: string
  email: string
  logo_url: string | null
  plan: 'free' | 'pro'
  created_at: string
}

export type User = {
  id: string
  agency_id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
}

export type LeadStage = 'lead' | 'visita' | 'proposta' | 'negociacao' | 'fechado'
export type LeadSource = 'site' | 'instagram' | 'facebook' | 'referencia' | 'outro'

export type Lead = {
  id: string
  agency_id: string
  assigned_to: string | null
  name: string
  email: string | null
  phone: string | null
  stage: LeadStage
  score: number
  source: LeadSource
  budget: number | null
  zone: string | null
  typology: string | null
  notes: string | null
  created_at: string
  users?: User
}

export type Contact = {
  id: string
  lead_id: string
  user_id: string | null
  type: 'chamada' | 'visita' | 'email' | 'nota'
  title: string
  description: string | null
  note: string | null
  created_at: string
  users?: User
}

export type Task = {
  id: string
  lead_id: string
  assigned_to: string | null
  title: string
  due_date: string | null
  completed: boolean
  created_at: string
}

export type EmailSent = {
  id: string
  lead_id: string
  sent_by: string | null
  subject: string
  body: string
  status: 'sent' | 'failed'
  sent_at: string
}
```

- [ ] **Step 2: Criar Supabase browser client**

Criar `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Criar Supabase server client**

Criar `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: Criar Resend client**

Criar `lib/resend.ts`:

```typescript
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
```

- [ ] **Step 5: Criar middleware de autenticação**

Criar `middleware.ts` na raiz do projecto:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublic = request.nextUrl.pathname === '/login'
  const isAdmin = request.nextUrl.pathname.startsWith('/admin')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAdmin && user?.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/ middleware.ts
git commit -m "feat: supabase clients, types, and auth middleware"
```

---

## Task 4: Design System e Layout Base

**Files:**
- Create: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/Topbar.tsx`
- Create: `app/(app)/layout.tsx`

- [ ] **Step 1: Configurar CSS global com variáveis de design**

Substituir conteúdo de `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Jost:wght@300;400;500;600&display=swap');

:root {
  --bg: #0D0D0F;
  --surface: #141416;
  --card: #1A1A1E;
  --border: #262629;
  --gold: #C9A84C;
  --gold-dim: #8B6F30;
  --gold-glow: rgba(201,168,76,0.12);
  --text: #E8E4DC;
  --muted: #7A7870;
  --green: #4ECCA3;
  --red: #E05C5C;
  --blue: #5C9EE0;
  --purple: #9B7FE8;
}

body {
  font-family: 'Jost', sans-serif;
  background: var(--bg);
  color: var(--text);
}

.font-display {
  font-family: 'Playfair Display', serif;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
```

- [ ] **Step 2: Criar Sidebar**

Criar `components/layout/Sidebar.tsx`:

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: '◎', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: '◈', label: 'Pipeline', section: 'Principal' },
]

type Props = {
  userName: string
  userInitials: string
}

export function Sidebar({ userName, userInitials }: Props) {
  const pathname = usePathname()

  return (
    <aside style={{ width: 240, minHeight: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 24px 32px', borderBottom: '1px solid var(--border)' }}>
        <div className="font-display" style={{ fontSize: 22, color: 'var(--gold)' }}>ImoFlow</div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>CRM Imobiliário</div>
      </div>

      <nav style={{ padding: '24px 0', flex: 1 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 24px', marginBottom: 6, marginTop: 16 }}>Principal</div>
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', fontSize: 13, color: active ? 'var(--gold)' : 'var(--muted)', background: active ? 'var(--gold-glow)' : 'transparent', borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent', textDecoration: 'none', transition: 'all 0.2s' }}>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Criar layout das páginas autenticadas**

Criar `app/(app)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, avatar_initials')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar
        userName={profile?.name ?? user.email ?? ''}
        userInitials={profile?.avatar_initials ?? 'XX'}
      />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/layout/ app/\(app\)/
git commit -m "feat: design system, sidebar, and authenticated layout"
```

---

## Task 5: Página de Login

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Criar página de login**

Criar `app/login/page.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou password incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="font-display" style={{ fontSize: 28, color: 'var(--gold)', marginBottom: 6 }}>ImoFlow</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>CRM Imobiliário</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'Jost, sans-serif', marginTop: 8 }}
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Testar login manualmente**

1. `npm run dev`
2. Abrir http://localhost:3000/login
3. Verificar que redireciona para /login quando não autenticado
4. (Credenciais de teste criadas na Task 9 — Admin Panel)

- [ ] **Step 3: Commit**

```bash
git add app/login/
git commit -m "feat: login page with Supabase auth"
```

---

## Task 6: API Routes — CRUD Leads

**Files:**
- Create: `app/api/leads/route.ts`
- Create: `app/api/leads/[id]/route.ts`

- [ ] **Step 1: Criar API route para listagem e criação de leads**

Criar `app/api/leads/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select('*, users(name, avatar_initials)')
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...body, agency_id: profile.agency_id, assigned_to: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Criar API route para lead individual**

Criar `app/api/leads/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, users(name, avatar_initials)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('leads')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/leads/
git commit -m "feat: leads CRUD API routes"
```

---

## Task 7: API Routes — Contacts, Tasks, Email

**Files:**
- Create: `app/api/contacts/route.ts`
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`
- Create: `app/api/emails/send/route.ts`

- [ ] **Step 1: API de contactos (histórico)**

Criar `app/api/contacts/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('contacts')
    .select('*, users(name, avatar_initials)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: API de tarefas**

Criar `app/api/tasks/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('lead_id', leadId)
    .order('due_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...body, assigned_to: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

Criar `app/api/tasks/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: API de envio de email**

Criar `app/api/emails/send/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, to_email, subject, body } = await request.json()
  if (!lead_id || !to_email || !subject || !body) {
    return NextResponse.json({ error: 'lead_id, to_email, subject e body são obrigatórios' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  let status: 'sent' | 'failed' = 'sent'
  try {
    await resend.emails.send({
      from: 'ImoFlow <noreply@imoflow.pt>',
      to: to_email,
      subject,
      text: body,
    })
  } catch {
    status = 'failed'
  }

  // Registar em emails_sent
  await supabase.from('emails_sent').insert({
    lead_id, sent_by: user.id, subject, body, status
  })

  // Registar no histórico de contactos
  if (status === 'sent') {
    await supabase.from('contacts').insert({
      lead_id,
      user_id: user.id,
      type: 'email',
      title: `Email enviado: ${subject}`,
      description: body,
    })
  }

  if (status === 'failed') {
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/contacts/ app/api/tasks/ app/api/emails/
git commit -m "feat: contacts, tasks, and email send API routes"
```

---

## Task 8: Dashboard

**Files:**
- Create: `app/(app)/dashboard/page.tsx`
- Create: `components/dashboard/StatCard.tsx`

- [ ] **Step 1: Criar StatCard component**

Criar `components/dashboard/StatCard.tsx`:

```typescript
type Props = {
  label: string
  value: string | number
  change?: string
  changeUp?: boolean
  icon: string
}

export function StatCard({ label, value, change, changeUp, icon }: Props) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, var(--gold-dim), transparent)', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: 18, right: 18, fontSize: 22, opacity: 0.2 }}>{icon}</div>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 32, color: 'var(--text)', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      {change && (
        <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: changeUp ? 'var(--green)' : 'var(--red)' }}>
          {changeUp ? '↑' : '↓'} {change}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar página de dashboard**

Criar `app/(app)/dashboard/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import Link from 'next/link'

const STAGE_COLORS: Record<string, string> = {
  lead: '#5C9EE0', visita: '#9B7FE8', proposta: '#E0A35C', negociacao: '#E0595C', fechado: '#4ECCA3'
}
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', visita: 'Visita', proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()

  const [{ data: leads }, { data: recentContacts }] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
    supabase.from('contacts').select('*, leads(name), users(name)').order('created_at', { ascending: false }).limit(5),
  ])

  const allLeads = leads ?? []
  const activeLeads = allLeads.filter(l => l.stage !== 'fechado').length
  const inNegotiation = allLeads.filter(l => l.stage === 'negociacao').length
  const closedThisMonth = allLeads.filter(l => {
    if (l.stage !== 'fechado') return false
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const stageCounts = allLeads.reduce((acc: Record<string, number>, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1
    return acc
  }, {})
  const total = allLeads.length || 1
  const recentLeads = allLeads.slice(0, 5)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile?.name?.split(' ')[0] ?? ''

  return (
    <>
      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500 }}>{greeting}, {firstName}</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{activeLeads} leads ativos</p>
        </div>
        <Link href="/leads" style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          + Novo Lead
        </Link>
      </div>

      <div style={{ padding: '28px 32px', flex: 1 }}>
        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Leads Ativos" value={activeLeads} icon="◎" />
          <StatCard label="Em Negociação" value={inNegotiation} icon="◈" />
          <StatCard label="Fechados (mês)" value={closedThisMonth} icon="✓" />
          <StatCard label="Total Leads" value={allLeads.length} icon="▦" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
          {/* PIPELINE */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Pipeline de Vendas
              <Link href="/pipeline" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'var(--gold)', fontWeight: 500, textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div key={stage} style={{ background: STAGE_COLORS[stage] ?? '#666', width: `${(count / total) * 100}%` }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: STAGE_COLORS[stage] ?? '#666' }} />
                  {STAGE_LABELS[stage]} ({count})
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLeads.map(lead => (
                <Link key={lead.id} href={`/leads/${lead.id}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, textDecoration: 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: STAGE_COLORS[lead.stage] ?? '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0D0D0F' }}>
                    {lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{lead.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{lead.typology ?? ''}{lead.zone ? ` · ${lead.zone}` : ''}{lead.budget ? ` · ${(lead.budget / 1000).toFixed(0)}K€` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, whiteSpace: 'nowrap' }}>{lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${STAGE_COLORS[lead.stage]}22`, color: STAGE_COLORS[lead.stage] }}>
                    {STAGE_LABELS[lead.stage]}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ATIVIDADE */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Atividade Recente</div>
            <div>
              {(recentContacts ?? []).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < (recentContacts?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                    {i < (recentContacts?.length ?? 0) - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: 20 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{c.title} — <strong style={{ color: 'var(--gold)', fontWeight: 500 }}>{(c.leads as any)?.name}</strong></div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{new Date(c.created_at).toLocaleDateString('pt-PT')}</div>
                  </div>
                </div>
              ))}
              {(recentContacts ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem atividade recente.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ app/\(app\)/dashboard/
git commit -m "feat: dashboard page with stats, pipeline summary, and activity feed"
```

---

## Task 9: Painel Admin (Super Admin)

**Files:**
- Create: `app/(app)/admin/page.tsx`
- Create: `app/api/admin/agencies/route.ts`

- [ ] **Step 1: API para criar agências**

Criar `app/api/admin/agencies/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin.from('agencies').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email, password } = await request.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email e password são obrigatórios' }, { status: 400 })
  }

  const admin = getAdminClient()

  // 1. Criar agência
  const { data: agency, error: agencyError } = await admin
    .from('agencies')
    .insert({ name, email })
    .select()
    .single()

  if (agencyError) return NextResponse.json({ error: agencyError.message }, { status: 500 })

  // 2. Criar utilizador no Auth
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    await admin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // 3. Criar perfil do utilizador
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  await admin.from('users').insert({
    id: authUser.user.id,
    agency_id: agency.id,
    name,
    email,
    role: 'admin',
    avatar_initials: initials,
  })

  return NextResponse.json({ agency, user: authUser.user }, { status: 201 })
}
```

- [ ] **Step 2: Criar página admin**

Criar `app/(app)/admin/page.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Agency } from '@/types'

export default function AdminPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/agencies')
      .then(r => r.json())
      .then(data => { setAgencies(data); setLoading(false) })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMessage('')
    const res = await fetch('/api/admin/agencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`✓ Agência "${form.name}" criada com sucesso.`)
      setForm({ name: '', email: '', password: '' })
      setAgencies(prev => [data.agency, ...prev])
    } else {
      setMessage(`✗ Erro: ${data.error}`)
    }
    setCreating(false)
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 6 }

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Admin — ImoFlow</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Gestão de agências clientes</p>
      </div>
      <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: 28 }}>
        {/* FORM */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div className="font-display" style={{ fontSize: 15, marginBottom: 20 }}>Nova Agência</div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={labelStyle}>Nome da Agência</label><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
            <div><label style={labelStyle}>Email de Acesso</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required /></div>
            <div><label style={labelStyle}>Password Inicial</label><input type="password" style={inputStyle} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} /></div>
            {message && <div style={{ fontSize: 12, color: message.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{message}</div>}
            <button type="submit" disabled={creating} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}>
              {creating ? 'A criar...' : 'Criar Agência'}
            </button>
          </form>
        </div>

        {/* LISTA */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
            <div className="font-display" style={{ fontSize: 15 }}>Agências Ativas ({agencies.length})</div>
          </div>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nome', 'Email', 'Plano', 'Criada em'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 22px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agencies.map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '12px 22px', fontSize: 13, fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>{a.name}</td>
                    <td style={{ padding: '12px 22px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>{a.email}</td>
                    <td style={{ padding: '12px 22px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,168,76,0.1)', color: 'var(--gold)' }}>{a.plan.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '12px 22px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>{new Date(a.created_at).toLocaleDateString('pt-PT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Testar criação de agência**

1. Fazer login com o email de super admin
2. Ir a http://localhost:3000/admin
3. Criar uma agência de teste: nome "Agência Teste", email "teste@exemplo.pt", password "123456"
4. Verificar que aparece na lista
5. Fazer logout e login com "teste@exemplo.pt" / "123456"
6. Confirmar que vê o dashboard vazio da agência

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/ app/\(app\)/admin/
git commit -m "feat: super admin panel for agency creation"
```

---

## Task 10: Página de Leads

**Files:**
- Create: `app/(app)/leads/page.tsx`
- Create: `components/leads/NewLeadModal.tsx`

- [ ] **Step 1: Criar modal de novo lead**

Criar `components/leads/NewLeadModal.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { LeadSource } from '@/types'

type Props = {
  onClose: () => void
  onCreated: () => void
}

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'site', label: '🌐 Site' },
  { value: 'instagram', label: '📱 Instagram' },
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'referencia', label: '👤 Referência' },
  { value: 'outro', label: '◯ Outro' },
]

export function NewLeadModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'site' as LeadSource, zone: '', typology: '', budget: '' })
  const [loading, setLoading] = useState(false)

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, budget: form.budget ? Number(form.budget) : null }),
    })
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Novo Lead</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Nome *</label><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Zona</label><input style={inputStyle} value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="Ex: Cascais" /></div>
            <div><label style={labelStyle}>Tipologia</label><input style={inputStyle} value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} placeholder="Ex: T3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Orçamento (€)</label><input type="number" style={inputStyle} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="Ex: 350000" /></div>
            <div>
              <label style={labelStyle}>Origem</label>
              <select style={{ ...inputStyle }} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Jost, sans-serif' }}>
              {loading ? 'A criar...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar página de leads**

Criar `app/(app)/leads/page.tsx`:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lead, LeadStage } from '@/types'
import { NewLeadModal } from '@/components/leads/NewLeadModal'

const STAGE_COLORS: Record<string, string> = {
  lead: '#5C9EE0', visita: '#9B7FE8', proposta: '#E0A35C', negociacao: '#E0595C', fechado: '#4ECCA3'
}
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', visita: 'Visita', proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado'
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (stageFilter) params.set('stage', stageFilter)
    const res = await fetch(`/api/leads?${params}`)
    const data = await res.json()
    setLeads(data)
    setLoading(false)
  }, [search, stageFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  return (
    <>
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onCreated={fetchLeads} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Leads</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads.length} leads</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>
          + Novo Lead
        </button>
      </div>

      <div style={{ padding: '20px 32px', display: 'flex', gap: 10 }}>
        <input
          placeholder="Pesquisar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
        >
          <option value="">Todas as fases</option>
          {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'Contacto', 'Interesse', 'Origem', 'Score', 'Fase'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>A carregar...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhum lead encontrado.</td></tr>
              )}
              {leads.map(lead => (
                <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lead.name}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{lead.phone ?? lead.email ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{[lead.typology, lead.zone, lead.budget ? `até ${(lead.budget/1000).toFixed(0)}K€` : null].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>{lead.source}</span>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                    <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: lead.score > 70 ? 'var(--green)' : lead.score > 40 ? 'var(--gold)' : 'var(--red)', width: `${lead.score}%` }} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${STAGE_COLORS[lead.stage]}22`, color: STAGE_COLORS[lead.stage], letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {STAGE_LABELS[lead.stage]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/leads/NewLeadModal.tsx app/\(app\)/leads/page.tsx
git commit -m "feat: leads list page with search, filters, and new lead modal"
```

---

## Task 11: Perfil do Lead

**Files:**
- Create: `app/(app)/leads/[id]/page.tsx`
- Create: `components/leads/SendEmailModal.tsx`

- [ ] **Step 1: Criar modal de envio de email**

Criar `components/leads/SendEmailModal.tsx`:

```typescript
'use client'
import { useState } from 'react'

type Props = {
  leadId: string
  leadEmail: string | null
  onClose: () => void
  onSent: () => void
}

export function SendEmailModal({ leadId, leadEmail, onClose, onSent }: Props) {
  const [to, setTo] = useState(leadEmail ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, to_email: to, subject, body }),
    })
    if (res.ok) { onSent(); onClose() }
    else { const d = await res.json(); setError(d.error ?? 'Erro ao enviar.') }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Enviar Email</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Para</label><input type="email" style={inputStyle} value={to} onChange={e => setTo(e.target.value)} required /></div>
          <div><label style={labelStyle}>Assunto</label><input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} required /></div>
          <div>
            <label style={labelStyle}>Mensagem</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.6 }} value={body} onChange={e => setBody(e.target.value)} required />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Jost, sans-serif' }}>
              {loading ? 'A enviar...' : '✉ Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar página do perfil do lead**

Criar `app/(app)/leads/[id]/page.tsx`:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lead, Contact, Task } from '@/types'
import { SendEmailModal } from '@/components/leads/SendEmailModal'

const STAGE_COLORS: Record<string, string> = {
  lead: '#5C9EE0', visita: '#9B7FE8', proposta: '#E0A35C', negociacao: '#E0595C', fechado: '#4ECCA3'
}
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', visita: 'Visita', proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado'
}
const STAGES = ['lead', 'visita', 'proposta', 'negociacao', 'fechado']

export default function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showEmail, setShowEmail] = useState(false)
  const [newContactTitle, setNewContactTitle] = useState('')
  const [newContactType, setNewContactType] = useState<Contact['type']>('nota')
  const [newContactDesc, setNewContactDesc] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')

  const fetchAll = useCallback(async () => {
    const [l, c, t] = await Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/contacts?lead_id=${id}`).then(r => r.json()),
      fetch(`/api/tasks?lead_id=${id}`).then(r => r.json()),
    ])
    setLead(l)
    setContacts(c)
    setTasks(t)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function updateStage(stage: string) {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) })
    setLead(prev => prev ? { ...prev, stage: stage as Lead['stage'] } : prev)
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, type: newContactType, title: newContactTitle, description: newContactDesc }) })
    setNewContactTitle(''); setNewContactDesc('')
    fetchAll()
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, title: newTaskTitle, due_date: newTaskDue || null }) })
    setNewTaskTitle(''); setNewTaskDue('')
    fetchAll()
  }

  async function toggleTask(taskId: string, completed: boolean) {
    await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !completed }) })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !completed } : t))
  }

  async function archiveLead() {
    if (!confirm('Arquivar este lead?')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    router.push('/leads')
  }

  if (!lead) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>

  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  return (
    <>
      {showEmail && <SendEmailModal leadId={id} leadEmail={lead.email} onClose={() => setShowEmail(false)} onSent={fetchAll} />}

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/leads" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Leads</Link>
          <span style={{ color: 'var(--border)' }}>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{lead.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEmail(true)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>✉ Enviar Email</button>
          <button onClick={archiveLead} style={{ ...inputStyle, background: 'rgba(224,92,92,0.1)', color: 'var(--red)', borderColor: 'rgba(224,92,92,0.25)', cursor: 'pointer' }}>✕ Arquivar</button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* HERO */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 20, alignItems: 'start' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${STAGE_COLORS[lead.stage]}, ${STAGE_COLORS[lead.stage]}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#fff' }}>
            {initials}
          </div>
          <div>
            <h2 className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>{lead.name}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: `${STAGE_COLORS[lead.stage]}22`, color: STAGE_COLORS[lead.stage] }}>
                {STAGE_LABELS[lead.stage]}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                {lead.source}
              </span>
            </div>
            {/* STAGE SELECTOR */}
            <div style={{ display: 'flex', gap: 6 }}>
              {STAGES.map(s => (
                <button key={s} onClick={() => updateStage(s)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: `1px solid ${lead.stage === s ? STAGE_COLORS[s] : 'var(--border)'}`, background: lead.stage === s ? `${STAGE_COLORS[s]}22` : 'transparent', color: lead.stage === s ? STAGE_COLORS[s] : 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontWeight: 600 }}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Score</div>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--gold)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
              <div className="font-display" style={{ fontSize: 20, color: 'var(--gold)', lineHeight: 1 }}>{lead.score}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>/100</div>
            </div>
          </div>
        </div>

        {/* CONTACT PILLS */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '📞', label: 'Telefone', value: lead.phone },
            { icon: '✉', label: 'Email', value: lead.email },
            { icon: '📍', label: 'Zona', value: lead.zone },
            { icon: '🏠', label: 'Tipologia', value: lead.typology },
            { icon: '€', label: 'Orçamento', value: lead.budget ? `${(lead.budget/1000).toFixed(0)}K€` : null },
          ].filter(p => p.value).map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{p.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          {/* ESQUERDA — HISTÓRICO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="font-display" style={{ fontSize: 14 }}>Histórico de Contactos</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                {/* FORM novo contacto */}
                <form onSubmit={addContact} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <select value={newContactType} onChange={e => setNewContactType(e.target.value as Contact['type'])} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="nota">Nota</option>
                    <option value="chamada">Chamada</option>
                    <option value="visita">Visita</option>
                    <option value="email">Email</option>
                  </select>
                  <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Título do contacto..." value={newContactTitle} onChange={e => setNewContactTitle(e.target.value)} required />
                  <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Registar</button>
                </form>
                {/* TIMELINE */}
                <div>
                  {contacts.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)', marginTop: 3, flexShrink: 0 }} />
                        {i < contacts.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{c.title}</div>
                        {c.description && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{c.description}</div>}
                        <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>{new Date(c.created_at).toLocaleString('pt-PT')} · {(c.users as any)?.name ?? ''}</div>
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem histórico ainda.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* DIREITA — TAREFAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div className="font-display" style={{ fontSize: 14 }}>Tarefas</div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <form onSubmit={addTask} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  <input style={inputStyle} placeholder="Nova tarefa..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" style={{ ...inputStyle, flex: 1 }} value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} />
                    <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Criar</button>
                  </div>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, opacity: t.completed ? 0.5 : 1 }}>
                      <div onClick={() => toggleTask(t.id, t.completed)} style={{ width: 16, height: 16, borderRadius: 4, border: t.completed ? 'none' : '1.5px solid var(--border)', background: t.completed ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 1, color: '#0D0D0F', fontSize: 10 }}>
                        {t.completed ? '✓' : ''}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: t.completed ? 'var(--muted)' : 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                        {t.due_date && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{new Date(t.due_date).toLocaleDateString('pt-PT')}</div>}
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sem tarefas.</p>}
                </div>
              </div>
            </div>

            {/* NOTAS */}
            {lead.notes && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div className="font-display" style={{ fontSize: 14, marginBottom: 10 }}>Notas</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{lead.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/leads/SendEmailModal.tsx app/\(app\)/leads/\[id\]/
git commit -m "feat: lead profile page with timeline, tasks, and email modal"
```

---

## Task 12: Pipeline Kanban

**Files:**
- Create: `app/(app)/pipeline/page.tsx`
- Create: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Criar KanbanBoard com drag-and-drop**

Criar `components/pipeline/KanbanBoard.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, LeadStage } from '@/types'
import { useRouter } from 'next/navigation'

const STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: '#5C9EE0' },
  { id: 'visita', label: 'Visita', color: '#9B7FE8' },
  { id: 'proposta', label: 'Proposta', color: '#E0A35C' },
  { id: 'negociacao', label: 'Negociação', color: '#E0595C' },
  { id: 'fechado', label: 'Fechado', color: '#4ECCA3' },
]

function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const initials = lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => router.push(`/leads/${lead.id}`)}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{lead.name}</div>
        </div>
        {(lead.typology || lead.zone) && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            {[lead.typology, lead.zone].filter(Boolean).join(' · ')}
          </div>
        )}
        {lead.budget && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {(lead.budget / 1000).toFixed(0)}K€
          </div>
        )}
      </div>
    </div>
  )
}

type Props = { initialLeads: Lead[] }

export function KanbanBoard({ initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function getStageLeads(stage: LeadStage) {
    return leads.filter(l => l.stage === stage)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const draggedLead = leads.find(l => l.id === active.id)
    if (!draggedLead) return

    // Determinar nova stage pelo container (over pode ser o container ou outro card)
    const targetStage = STAGES.find(s => s.id === over.id)?.id
      ?? leads.find(l => l.id === over.id)?.stage

    if (!targetStage || targetStage === draggedLead.stage) return

    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, stage: targetStage } : l))
    await fetch(`/api/leads/${draggedLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage }),
    })
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
        {STAGES.map(stage => {
          const stageLeads = getStageLeads(stage.id)
          return (
            <div key={stage.id} id={stage.id} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', background: 'var(--border)', padding: '1px 7px', borderRadius: 10 }}>{stageLeads.length}</span>
              </div>
              <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div style={{ minHeight: 80 }}>
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} />
                  ))}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Criar página de pipeline**

Criar `app/(app)/pipeline/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Pipeline</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads?.length ?? 0} leads no pipeline</p>
      </div>
      <div style={{ padding: '24px 32px', flex: 1, overflow: 'hidden' }}>
        <KanbanBoard initialLeads={leads ?? []} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/ app/\(app\)/pipeline/
git commit -m "feat: kanban pipeline with drag-and-drop stage updates"
```

---

## Task 13: Root Layout e Redirect

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Actualizar root layout**

Substituir `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ImoFlow CRM',
  description: 'CRM Imobiliário para agências',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Criar redirect da raiz**

Criar `app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  redirect('/login')
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: root layout and auth redirect"
```

---

## Task 14: Deploy no Vercel

- [ ] **Step 1: Criar repositório no GitHub**

```bash
cd /Users/tomassampaio/Desktop/imoflow
git remote add origin https://github.com/SEU_USERNAME/imoflow.git
git push -u origin main
```

- [ ] **Step 2: Conectar ao Vercel**

1. Ir a vercel.com → New Project → importar repositório do GitHub
2. Em "Environment Variables", adicionar todas as variáveis do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `SUPER_ADMIN_EMAIL`
3. Clicar Deploy

- [ ] **Step 3: Verificar deploy**

1. Abrir URL do Vercel (ex: imoflow.vercel.app)
2. Testar login com conta super admin
3. Criar uma agência via `/admin`
4. Login com as credenciais da agência
5. Criar um lead e movê-lo no pipeline
6. Enviar um email de teste

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "chore: production deployment to Vercel"
```

---

## Self-Review

**Spec coverage:**
- ✓ Login com email + password
- ✓ Dashboard com métricas, pipeline, atividade
- ✓ Lista de leads com filtros e pesquisa
- ✓ Perfil de lead com histórico, tarefas, email
- ✓ Pipeline kanban com drag-and-drop
- ✓ Painel admin para criar agências
- ✓ Isolamento multi-tenant via RLS
- ✓ Envio de email via Resend
- ✓ Custo €0

**Placeholder scan:** Nenhum TBD, TODO ou implementação por completar.

**Type consistency:** Todos os tipos definidos em `types/index.ts` e usados consistentemente nas tasks 6–12. `LeadStage` usado no kanban e na API. `Contact['type']` usado no formulário do perfil.
