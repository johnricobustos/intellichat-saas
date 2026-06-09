# IntelliChat SaaS - Project TODO

## Core Architecture
- [x] Database schema design (organizations, documents, chunks, conversations, messages, Q&A pairs, escalation rules, analytics)
- [x] Multi-tenant organization isolation
- [x] Role-based access control (owner/admin/member)

## Document Upload & Processing
- [x] File upload endpoint (text content, file reader)
- [x] URL content ingestion
- [x] Document chunking pipeline (split into ~500-token chunks)
- [x] Text embedding generation via LLM API
- [x] Vector storage for document chunks (cosine similarity)
- [x] Document management CRUD (list, delete)

## RAG-Powered AI Chat Engine
- [x] Semantic search over document chunks (cosine similarity)
- [x] Context assembly from top-k relevant chunks
- [x] LLM response generation with retrieved context
- [x] Q&A override matching (custom pairs take priority)
- [x] Confidence scoring for responses
- [x] Conversation memory within a session

## Embeddable Chat Widget
- [x] Lightweight JavaScript widget snippet
- [x] Widget configuration (colors, position, welcome message)
- [x] Public chat API endpoint (no auth required, org identified by API key)
- [x] Widget embed code generator in admin dashboard

## Admin Dashboard
- [x] Dashboard layout with sidebar navigation
- [x] Document management page (upload, list, delete, status)
- [x] Conversation history viewer (search, filter by status)
- [x] Bot settings page (personality, tone, welcome message, color)
- [x] Organization settings (name, API keys, plan info)
- [x] Team management section (owner view, invite placeholder for Pro plans)

## Continuous Learning / Q&A Training
- [x] Q&A pairs CRUD (add, edit, delete, toggle active)
- [x] Review panel: see recent escalated conversations
- [x] Correction workflow: admin creates Q&A pair from conversation question
- [x] Q&A pairs matched before RAG retrieval for exact/fuzzy matches

## Escalation System
- [x] Configurable confidence threshold (below X% → escalate)
- [x] Keyword trigger rules (specific words → escalate)
- [x] Escalation actions: email notification, flag for human review
- [x] Escalation log in admin dashboard (view escalated conversations)

## Analytics Dashboard
- [x] Total conversations and messages over time
- [x] Top questions (from Q&A pair match counts)
- [x] Resolution rate (answered vs escalated)
- [x] Escalation rate tracking
- [x] Conversation volume charts (daily activity)
- [x] Conversation overview (active/resolved/escalated counts)

## Subscription Billing (Stripe)
- [x] Tiered plans: Starter, Pro, Enterprise with feature details
- [x] Usage limits per plan (messages, documents, organizations)
- [x] Client-facing billing page with plan details and usage bar
- [x] Stripe integration structure (ready for API keys)
- [ ] Live Stripe checkout (requires client's Stripe API keys)
- [ ] Webhook handling for subscription events (requires Stripe keys)

## Documentation
- [x] Comprehensive README with project overview
- [x] Environment variable reference
- [x] Local development setup guide
- [x] How-to-embed instructions for client websites
- [x] White-label duplication guide
- [x] API documentation
- [x] Database schema documentation

## Polish & Testing
- [x] Vitest unit tests for core backend logic (11 tests passing)
- [x] Responsive design across all pages
- [x] Loading states and error handling
- [x] Dark theme support
- [x] Landing page with feature showcase
