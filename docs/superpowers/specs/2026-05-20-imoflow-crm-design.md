# ImoFlow CRM — Especificação de Design
**Data:** 2026-05-20
**Projeto:** ImoFlow CRM
**Versão:** 1.0 (MVP)

---

## Visão Geral

O ImoFlow é um CRM SaaS para agências imobiliárias, desenvolvido e comercializado pela Satus. O proprietário (Tomas) cria manualmente as contas de cada agência cliente e envia as credenciais. As agências entram com email + password e gerem os seus leads de forma completamente isolada.

---

## Stack Técnico

| Camada | Tecnologia | Custo |
|---|---|---|
| Frontend + Backend | Next.js (React) | Gratuito |
| Base de dados + Auth | Supabase (PostgreSQL) | Gratuito (tier free) |
| Envio de emails | Resend | Gratuito (3.000/mês) |
| Hosting | Vercel | Gratuito |

Custo total inicial: **€0**.

---

## Arquitetura Multi-Tenant

Cada agência tem os seus dados completamente isolados. O isolamento é garantido por Row Level Security (RLS) no Supabase — cada tabela tem um `agency_id` e as políticas garantem que um utilizador só vê os registos da sua agência.

Existem 3 tipos de acesso:
- **Super Admin (Tomas):** acesso ao painel `/admin` — cria e lista agências
- **Admin da agência:** acesso total ao CRM da sua agência
- **Agente (futuro v2):** acesso limitado aos próprios leads

---

## Modelo de Dados

### `agencies`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| name | text | Nome da agência |
| email | text | Email de login |
| logo_url | text | URL do logo (opcional) |
| plan | text | `free` / `pro` |
| created_at | timestamptz | |

### `users`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK, referencia auth.users |
| agency_id | uuid | FK → agencies |
| name | text | |
| email | text | |
| role | text | `admin` / `agent` |
| avatar_initials | text | Ex: "JM" |

### `leads`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| agency_id | uuid | FK → agencies |
| assigned_to | uuid | FK → users |
| name | text | |
| email | text | |
| phone | text | |
| stage | text | `lead` / `visita` / `proposta` / `negociacao` / `fechado` |
| score | int | 0–100 |
| source | text | `site` / `instagram` / `facebook` / `referencia` / `outro` |
| budget | numeric | Orçamento máximo em € |
| zone | text | Zona de interesse |
| typology | text | Ex: "T3" |
| notes | text | Nota rápida |
| created_at | timestamptz | |

### `contacts` (histórico de interações)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| lead_id | uuid | FK → leads |
| user_id | uuid | FK → users |
| type | text | `chamada` / `visita` / `email` / `nota` |
| title | text | |
| description | text | |
| note | text | Nota privada do agente |
| created_at | timestamptz | |

### `tasks`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| lead_id | uuid | FK → leads |
| assigned_to | uuid | FK → users |
| title | text | |
| due_date | date | |
| completed | boolean | default false |
| created_at | timestamptz | |

### `emails_sent`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| lead_id | uuid | FK → leads |
| sent_by | uuid | FK → users |
| subject | text | |
| body | text | |
| status | text | `sent` / `failed` |
| sent_at | timestamptz | |

---

## Páginas do MVP

### `/login` — Público
- Formulário email + password
- Autenticação via Supabase Auth
- Redireciona para `/dashboard` após login
- Design: dark, logo ImoFlow centrado

### `/dashboard` — Privado
- 4 stat cards: Leads Ativos, Em Negociação, Escrituras (mês), Volume Faturado
- Pipeline resumido com barra de fases e lista dos 4–5 deals mais recentes
- Feed de atividade recente (últimas 5 entradas de `contacts`)
- Tabela com os 5 leads mais recentes
- Botão "+ Novo Lead"

### `/leads` — Privado
- Tabela com todos os leads da agência
- Colunas: Nome, Contacto, Interesse, Origem, Score, Fase, Agente
- Filtros: por fase, por fonte
- Pesquisa por nome/email/telefone
- Botão "+ Novo Lead" abre modal com formulário
- Clique numa linha navega para `/leads/[id]`

### `/leads/[id]` — Privado
- Hero: avatar, nome, fase, score, tags (quente/frio, origem)
- Pills de contacto: telefone, email, WhatsApp, próxima ação
- Coluna esquerda: histórico de contactos (timeline) + imóveis compatíveis (futuro)
- Coluna direita: preferências editáveis + tarefas + nota rápida
- Ações no topbar: Enviar Email (abre modal) · Agendar Visita (abre modal) · Arquivar
- Modal "Enviar Email": assunto + corpo → envia via Resend, regista em `emails_sent` e `contacts`

### `/pipeline` — Privado
- Kanban com 5 colunas: Lead · Visita · Proposta · Negociação · Fechado
- Cada card mostra: nome do lead, valor do negócio, agente atribuído
- Drag-and-drop para mover entre fases (atualiza `stage` no lead)
- Clique no card abre `/leads/[id]`

### `/admin` — Só Super Admin
- Protegido: apenas o email do super admin tem acesso
- Lista de todas as agências com data de criação e plano
- Formulário "Nova Agência": nome, email, password inicial
- Cria registo em `agencies` + utilizador em Supabase Auth

---

## Design Visual

- Fundo escuro: `#0D0D0F`
- Acentos dourados: `#C9A84C`
- Tipografia: Playfair Display (títulos) + Jost (corpo)
- Consistente com os mockups `crm-demo.html` e `crm-lead.html` existentes

---

## Fora de Âmbito (v1)

- Convite de agentes (agências usam uma única conta por agora)
- Calendário integrado
- Automações
- Relatórios avançados
- Listagem de imóveis
- Planos pagos / billing

---

## Critérios de Sucesso do MVP

1. Tomas consegue criar uma agência no `/admin` em menos de 1 minuto
2. A agência entra com as credenciais e vê o dashboard da sua conta
3. É possível criar, editar e mover leads no pipeline
4. É possível enviar um email a um lead direto do seu perfil
5. Duas agências diferentes nunca veem os dados uma da outra
