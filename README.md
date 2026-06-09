# IntelliChat — AI Customer Support Chatbot SaaS

A full-stack, multi-tenant SaaS platform that lets businesses deploy a RAG-powered AI chatbot trained on their own documents. Embeddable on any website with a single script tag.

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Tenant Architecture** | Each client gets an isolated organization with their own knowledge base, settings, and chat history |
| **Document Upload & Processing** | Upload PDFs, text files, and URLs; the system chunks and indexes content into a searchable knowledge base |
| **RAG-Powered AI Chat** | Retrieves relevant document chunks and generates accurate answers using an LLM scoped to the client's knowledge base |
| **Embeddable Chat Widget** | A lightweight JavaScript snippet that clients paste into any website to display their chatbot |
| **Admin Dashboard** | Manage documents, view conversations, configure bot personality, and set escalation rules |
| **Continuous Learning (Q&A Training)** | Admins can review bot responses, correct wrong answers, and add custom Q&A pairs that override AI responses |
| **Escalation System** | Configurable rules based on confidence thresholds and keyword triggers that route conversations to email or human agents |
| **Analytics Dashboard** | Track most asked questions, resolution rate, escalation rate, and conversation volume over time |
| **Subscription Billing** | Tiered plans (Starter, Pro, Enterprise) with usage limits and a client-facing billing page |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 |
| Backend | Express + tRPC 11 |
| Database | MySQL/TiDB (Drizzle ORM) |
| AI/LLM | OpenAI-compatible API (configurable) |
| Auth | OAuth 2.0 |
| Storage | S3-compatible object storage |
| Widget | Vanilla JavaScript (zero dependencies) |

---

## Project Structure

```
intellichat-saas/
├── client/                    # Frontend React application
│   ├── public/
│   │   └── widget.js         # Embeddable chat widget (vanilla JS)
│   └── src/
│       ├── pages/            # All page components
│       │   ├── Home.tsx      # Landing page + onboarding
│       │   ├── Dashboard.tsx # Main dashboard
│       │   ├── Documents.tsx # Knowledge base management
│       │   ├── Conversations.tsx # Chat history viewer
│       │   ├── QATraining.tsx # Q&A pair management
│       │   ├── Analytics.tsx # Performance metrics
│       │   ├── Escalation.tsx # Escalation rules
│       │   ├── WidgetSetup.tsx # Embed code & instructions
│       │   ├── Billing.tsx   # Subscription plans
│       │   └── Settings.tsx  # Organization settings
│       ├── components/       # Reusable UI components
│       └── contexts/         # React contexts (Org, Theme)
├── server/                    # Backend API
│   ├── routers.ts            # tRPC API routes
│   ├── db.ts                 # Database query helpers
│   ├── rag.ts                # RAG engine (chunking, embeddings, search)
│   ├── storage.ts            # S3 file storage
│   └── _core/               # Framework internals (auth, LLM, etc.)
├── drizzle/                   # Database schema & migrations
│   └── schema.ts            # All table definitions
└── shared/                    # Shared types & constants
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MySQL or TiDB database
- OpenAI-compatible API key (for LLM)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/intellichat-saas.git
cd intellichat-saas

# Install dependencies
pnpm install

# Set up environment variables (see below)
cp .env.example .env

# Run database migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# Auth (OAuth 2.0)
JWT_SECRET=your-jwt-secret
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://your-oauth-provider.com
VITE_OAUTH_PORTAL_URL=https://your-oauth-login-page.com

# LLM API (OpenAI-compatible)
BUILT_IN_FORGE_API_URL=https://api.openai.com
BUILT_IN_FORGE_API_KEY=sk-your-api-key

# Storage (S3-compatible)
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Stripe Billing (optional - enables subscription payments)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_STARTER_PRICE_ID=price_starter_id
STRIPE_PRO_PRICE_ID=price_pro_id
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_id
```

### Stripe Setup (Optional)

To enable subscription billing:

1. Create a [Stripe account](https://stripe.com)
2. In Stripe Dashboard, create 3 Products with recurring prices:
   - Starter ($29/month)
   - Pro ($79/month)
   - Enterprise ($199/month)
3. Copy each Price ID into the environment variables above
4. Set up a webhook endpoint pointing to `https://your-domain.com/api/webhooks/stripe`
5. Select these webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
6. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## How to Embed the Widget on a Client's Website

### Step 1: Get the API Key

After creating an organization in the admin dashboard, go to **Settings** to find your API key.

### Step 2: Add the Script Tag

Paste this code just before the closing `</body>` tag on any website:

```html
<!-- IntelliChat Widget -->
<script>
  (function() {
    var w = document.createElement('script');
    w.src = 'https://YOUR_INTELLICHAT_DOMAIN/widget.js';
    w.setAttribute('data-api-key', 'YOUR_API_KEY_HERE');
    w.setAttribute('data-position', 'bottom-right');
    w.async = true;
    document.head.appendChild(w);
  })();
</script>
```

### Configuration Options

| Attribute | Values | Default | Description |
|-----------|--------|---------|-------------|
| `data-api-key` | String | (required) | Your organization API key |
| `data-position` | `bottom-right`, `bottom-left` | `bottom-right` | Widget position on the page |

### Step 3: Upload Documents

1. Log into the admin dashboard
2. Go to **Documents** → **Add Document**
3. Paste your FAQ, product info, pricing, policies, etc.
4. The system will automatically chunk and index the content

### Step 4: Configure the Bot

1. Go to **Settings**
2. Set the bot name, welcome message, and personality
3. Choose a primary color to match the client's brand

---

## How to Duplicate for a New Client (White-Label Guide)

### Option A: Multi-Tenant (Recommended)

The platform is already multi-tenant. Each user who signs up gets their own isolated organization. To set up for a new client:

1. Have the client sign up (or create an account for them)
2. Create a new organization with their company name
3. Upload their documents to the knowledge base
4. Give them the embed code with their unique API key
5. Each organization has completely isolated data

### Option B: Separate Instance (Full White-Label)

For complete white-labeling with custom domains:

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/intellichat-saas.git client-name-bot
   cd client-name-bot
   ```

2. **Set up a new database** for the client

3. **Configure environment variables** with the client's credentials

4. **Customize branding:**
   - Update `client/index.html` title
   - Modify colors in `client/src/index.css`
   - Update the logo in the DashboardLayout

5. **Deploy** to your hosting provider (Vercel, Railway, etc.)

6. **Point the client's domain** to the deployment

---

## API Reference

### Public Endpoints (for the widget)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `chat.config` | GET | Get widget configuration (bot name, colors) |
| `chat.send` | POST | Send a message and get AI response |
| `chat.opened` | POST | Track widget open event |

### Protected Endpoints (admin dashboard)

| Endpoint | Description |
|----------|-------------|
| `org.list` | List user's organizations |
| `org.create` | Create new organization |
| `org.update` | Update organization settings |
| `documents.list` | List documents in knowledge base |
| `documents.upload` | Upload and process a document |
| `documents.delete` | Remove a document |
| `conversations.list` | List all conversations |
| `conversations.get` | Get conversation with messages |
| `qaPairs.list` | List Q&A training pairs |
| `qaPairs.create` | Add new Q&A pair |
| `escalation.list` | List escalation rules |
| `escalation.create` | Create escalation rule |
| `analytics.summary` | Get analytics summary |
| `analytics.timeline` | Get timeline data |

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (OAuth) |
| `organizations` | Client organizations (multi-tenant) |
| `org_members` | Organization membership |
| `documents` | Uploaded knowledge base documents |
| `document_chunks` | Processed text chunks with embeddings |
| `conversations` | Chat sessions |
| `messages` | Individual chat messages |
| `qa_pairs` | Custom Q&A training pairs |
| `escalation_rules` | Escalation configuration |
| `analytics_events` | Event tracking data |

---

## How the RAG Engine Works

1. **Document Upload** → Text is extracted and split into chunks (~500 words each)
2. **Embedding Generation** → Each chunk gets a vector embedding for semantic search
3. **User Asks a Question** → The question is embedded and compared against all chunks
4. **Top-K Retrieval** → Most relevant chunks are retrieved (cosine similarity)
5. **Q&A Override Check** → Custom Q&A pairs are checked first (exact/fuzzy match)
6. **LLM Generation** → The LLM generates an answer using the retrieved context
7. **Confidence Scoring** → Response confidence is estimated
8. **Escalation Check** → Rules are evaluated; escalate if triggered

---

## Subscription Plans

| Plan | Price | Messages/Month | Documents | Chatbots |
|------|-------|---------------|-----------|----------|
| Starter | $29/mo | 1,000 | 5 | 1 |
| Pro | $79/mo | 10,000 | 50 | 5 |
| Enterprise | $199/mo | Unlimited | Unlimited | Unlimited |

---

## Deployment

### Production Build

```bash
pnpm build
pnpm start
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Hosting Recommendations

- **Vercel** — Great for frontend + serverless functions
- **Railway** — Full-stack with database included
- **Fly.io** — Global edge deployment
- **AWS ECS** — Enterprise-grade scaling

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Support

For questions or issues, please open a GitHub issue or contact the maintainer.
