<p align="center">
  <img src="./frontend/public/Logo.png" alt="TypeTrace Logo" width="240" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-Frontend-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/scikit--learn-ML-F7931E?logo=scikitlearn&logoColor=white" alt="scikit-learn" />
</p>

<p align="center">
  <strong>Behavioral authorship evidence for academic writing.</strong>
</p>

<p align="center">
  TypeTrace captures how academic work is produced - including keystrokes, timing patterns, pauses, revisions, deletions and paste activity - and turns that writing-process evidence into a reviewable session record and verifiable certificate.
</p>

---

## Overview

TypeTrace is a full-stack academic integrity and behavioral-evidence platform designed for students and educators. Instead of judging authorship only from the final submitted text, TypeTrace records the writing process itself and evaluates the behavioral evidence generated during a writing session.

A student writes inside the TypeTrace editor, the system captures structured keystroke and editing evidence, validates the event stream, performs behavioral and machine-learning analysis, stores the protected session record, and generates a certificate linked to the evidence. Teachers can review course submissions, replay writing sessions, record review outcomes and feedback, while public certificate verification exposes only the information intended for verification.

> **Important:** TypeTrace is decision-support software. It provides behavioral authorship evidence that can support academic review; it does not establish authorship or academic misconduct with absolute certainty.

---

## Why TypeTrace?

Conventional AI-text detectors mainly inspect the final written output. That approach can produce false positives and gives reviewers little visibility into how a document was actually created.

TypeTrace uses a process-based approach:

- Records how the document was produced rather than relying only on the final text.
- Captures typing rhythm, pauses, revisions, deletions, cut/paste activity and related behavioral signals.
- Validates that captured writing events can reconstruct the submitted document.
- Uses a timing-only Isolation Forest together with separate behavioral and paste-policy safeguards.
- Preserves evidence hashes and document hashes for integrity checks.
- Produces a signed certificate linked to the recorded writing session.
- Gives teachers access to replayable evidence, review outcomes and feedback workflows.
- Keeps public verification privacy-limited rather than exposing the student's full writing evidence.

---

## Main Workflows

### Student

- Registration, OTP verification, login and password recovery
- Secure authenticated sessions
- New writing-session creation
- Keystroke and behavioral event capture
- Pause, deletion, revision, cut and paste tracking
- Automatic draft persistence and draft recovery
- Multiple independent drafts with server synchronization across browsers
- Writing-session analysis and evidence scoring
- Session history and detailed session views
- Writing-process replay
- Certificate generation and PDF download
- Analytics dashboard
- Course enrollment through invite codes
- **Course Management** for all joined courses, including historical/archived enrollments
- Course-level submitted sessions, review status, certificates and teacher feedback
- Notifications
- Profile, password, privacy export and account-deletion controls

### Teacher

- Teacher registration and authentication
- Teacher dashboard
- Course creation and management
- Student enrollment using course invite codes
- Student roster and submission management
- Review of course-linked writing sessions
- Replay and certificate evidence access
- Review outcomes and written feedback
- Notifications for relevant course activity

### Public Certificate Verification

- Certificate lookup by certificate ID
- Certificate status and revocation awareness
- Human-writing evidence / risk presentation
- Document and evidence integrity information
- Signed certificate verification data
- Certificate PDF support
- Privacy-controlled public fields

---

## How the Evidence Pipeline Works

```text
Student writes in the TypeTrace editor
              │
              ▼
Keystroke + edit + timing events are captured
              │
              ▼
Server creates canonical writing evidence
              │
              ├── Replay/document integrity validation
              ├── Evidence hash + document hash
              │
              ▼
Timing-only Isolation Forest analysis
              │
              +
              │
Behavioral analysis + paste-policy safeguards
              │
              ▼
Evidence fusion / final classification and risk
              │
              ▼
Encrypted session record + audit trail
              │
              ▼
Signed TypeTrace certificate
              │
              ▼
Student / teacher review + public verification
```

### Classification Language

The runtime application normalizes results into review-oriented categories such as:

- `HUMAN`
- `SUSPICIOUS`
- `SYNTHETIC`

These labels are evidence indicators, not disciplinary conclusions. Teacher review and academic judgement remain separate from the automated analysis.

---

## Machine-Learning Architecture

The production TypeTrace model is **`TypeTrace Isolation Forest`**, version **`isolation-forest-v2-timing-only`**.

Key properties of the current model contract:

- Isolation Forest consumes **43 ordered timing/cross-domain features**.
- Model feature order is contractual and validated before inference.
- TypeTrace-specific live-writing features such as paste ratio, deletion pressure and idle-break behavior are **not passed into the Isolation Forest**.
- Those additional signals remain available to the separate behavioral-analysis and paste-policy layers.
- Production model artifacts are validated through a manifest and smoke-test workflow.
- The runtime can contain controlled fallback behavior when the trained artifact is unavailable; degraded analysis is recorded rather than silently presented as normal model inference.

Production artifacts are stored under:

```text
backend/app/ml/artifacts/
```

This includes the trained Isolation Forest, scaler, feature schema, model metadata, metrics and artifact manifest.

---

## Technology Stack

| Layer | Current repository technology |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8 |
| Styling | Tailwind CSS 3 |
| Routing | React Router 7 |
| Client State | Zustand 5 |
| HTTP Client | Axios |
| Charts | Recharts |
| Backend | FastAPI 0.115 |
| ORM | SQLAlchemy 2 |
| Database | PostgreSQL 15 (Docker image) |
| Cache / transient auth state | Redis 7 |
| Migrations | Alembic |
| Authentication | JWT + password hashing + OTP lifecycle |
| Evidence Encryption | `cryptography` / Fernet-based application encryption |
| Certificate Signing | Ed25519 support with local HMAC compatibility fallback |
| Machine Learning | scikit-learn, NumPy, Pandas, joblib |
| Production Model | Timing-only Isolation Forest |
| Certificate / QR Output | ReportLab, Pillow, qrcode |
| Frontend Testing | Vitest, React Testing Library, JSDOM, V8 coverage |
| Browser / E2E Testing | Playwright |
| Backend Testing | `unittest`, FastAPI TestClient / HTTPX, Coverage.py |
| Container Support | Docker Compose |

---

## Repository Structure

```text
TypeTrace/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Shared FastAPI dependencies
│   │   │   └── routes/              # HTTP API routes
│   │   ├── core/                    # Config, JWT, crypto, privacy, security, limits
│   │   ├── db/                      # Database engine/session setup
│   │   ├── middleware/              # Request-size and security-header middleware
│   │   ├── ml/                      # Feature extraction, inference, behavior, artifacts
│   │   ├── models/                  # SQLAlchemy database models
│   │   ├── repositories/            # Database query/data-access layer
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── services/                # Domain/business services
│   │   └── main.py                  # FastAPI application entry point
│   ├── migrations/                  # Alembic migration environment + versions
│   ├── scripts/                     # ML regression, smoke, audit and maintenance tools
│   ├── tests/                       # Backend automated test suite
│   ├── .coveragerc                  # Backend coverage configuration
│   ├── requirements.txt             # Runtime dependencies
│   ├── requirements-test.txt        # Test/coverage dependencies
│   └── alembic.ini
│
├── frontend/
│   ├── e2e/                         # Playwright browser/E2E tests
│   │   └── support/                 # Shared E2E helpers
│   ├── public/                      # Static images, logo and public assets
│   ├── src/
│   │   ├── __tests__/               # Vitest/React Testing Library tests
│   │   ├── assets/                  # Bundled frontend assets
│   │   ├── components/              # Reusable React components/layouts/guards/UI
│   │   ├── constants/               # Frontend routes, API routes and metadata
│   │   ├── hooks/                   # Reusable React behavior
│   │   ├── lib/                     # API client and non-UI application utilities
│   │   ├── pages/                   # Public, student and teacher pages
│   │   ├── store/                   # Zustand stores
│   │   ├── styles/                  # Centralized design/color definitions
│   │   ├── test/                    # Global Vitest setup
│   │   ├── types/                   # TypeScript data contracts
│   │   ├── App.tsx                  # Route composition
│   │   └── main.tsx                 # Frontend bootstrap
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   └── eslint.config.js
│
├── docker-compose.yml               # PostgreSQL + Redis local infrastructure
├── .env.example                     # Safe local environment template
├── .gitignore
├── run_comprehensive_test_coverage.py
├── report_coverage_gaps.py
├── *.ps1                            # PowerShell setup/test/security automation
└── README.md
```

---

## Prerequisites

For the current frontend toolchain, use:

- **Node.js 20.19+ or 22.12+**
- npm
- Python 3.11+ (a recent supported Python version is recommended)
- PostgreSQL 15 when running without Docker
- Redis 7 when running without Docker
- Git
- Docker Desktop / Docker Engine with Compose support - optional, but recommended for local PostgreSQL and Redis

---

# Local Development Setup

## 1. Clone the Repository

```bash
git clone <repository-url>
cd TypeTrace
```

---

## 2. Create the Root Environment File

Windows Command Prompt / PowerShell:

```powershell
copy .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

Replace placeholder secrets before starting the backend.

### Generate a strong application secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use the generated value for:

```text
SECRET_KEY=
```

### Generate the evidence-encryption key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Use the generated value for:

```text
ENCRYPTION_MASTER_KEY=
```

> Never commit `.env`, signing private keys, SMTP credentials or other secrets.

---

## 3. Align PostgreSQL Configuration

The backend loads environment values from the project-root `.env` and then `backend/.env` if present.

If you use `docker-compose.yml`, make sure the Compose database credentials and `DATABASE_URL` describe the **same database**. For example, for a local-only setup you can add:

```text
POSTGRES_USER=typetrace_admin
POSTGRES_PASSWORD=change-this-local-password
POSTGRES_DB=typetracedb
POSTGRES_PORT=5432
REDIS_PORT=6379

DATABASE_URL=postgresql+asyncpg://typetrace_admin:change-this-local-password@localhost:5432/typetracedb
```

The values above are examples for local development only. Use appropriate secrets for any shared or deployed environment.

---

## 4. Start PostgreSQL and Redis

From the repository root:

```bash
docker compose up -d
```

Check container status:

```bash
docker compose ps
```

Stop the services:

```bash
docker compose down
```

Delete the local PostgreSQL volume as well:

```bash
docker compose down -v
```

> `docker compose down -v` permanently removes the local database volume.

---

## 5. Backend Setup

```bash
cd backend
python -m venv venv
```

Activate the environment.

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Windows Command Prompt:

```bat
venv\Scripts\activate.bat
```

macOS / Linux:

```bash
source venv/bin/activate
```

Install runtime and test dependencies:

```bash
pip install -r requirements.txt
pip install -r requirements-test.txt
```

Apply database migrations:

```bash
alembic upgrade head
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Development endpoints:

```text
API:        http://127.0.0.1:8000
Health:     http://127.0.0.1:8000/api/v1/health
Swagger UI: http://127.0.0.1:8000/docs
```

Swagger/OpenAPI documentation is intended for development and is disabled when production configuration disables API docs.

Expected health response:

```json
{
  "status": "ok",
  "service": "TypeTrace API"
}
```

---

## 6. Configure OTP / Password-Reset Email When Needed

Real registration and password-recovery flows require working mail configuration. Set the relevant `MAIL_*` environment values for your SMTP provider, for example:

```text
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=
MAIL_SERVER=
MAIL_PORT=
MAIL_STARTTLS=
MAIL_SSL_TLS=
```

Do not place real credentials in source control.

---

## 7. Certificate Signing

TypeTrace supports Ed25519 certificate signing. After backend dependencies are installed, a local keypair can be generated from the repository root with:

```bash
python backend/scripts/generate_signing_key.py
```

Copy the generated values into your private `.env`:

```text
CERTIFICATE_SIGNING_KEY_ID=
CERTIFICATE_SIGNING_PRIVATE_KEY=
CERTIFICATE_SIGNING_PUBLIC_KEY=
CERTIFICATE_ALLOW_HMAC_FALLBACK=false
```

Never commit the private signing key.

For local development the application also supports an explicit HMAC compatibility fallback. Production-style deployments should use proper signing keys and disable fallback.

---

## 8. Frontend Setup

Open a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The frontend development server normally runs at:

```text
http://localhost:5173
```

The frontend defaults to this API base URL:

```text
http://localhost:8000/api/v1
```

To use a different backend URL, set `VITE_API_BASE_URL` in a local Vite environment file or shell environment.

Production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## Recommended Startup Order

```text
1. Start PostgreSQL and Redis
2. Activate the backend virtual environment
3. Apply Alembic migrations
4. Start the FastAPI backend
5. Start the React/Vite frontend
6. Confirm /api/v1/health returns status=ok
7. Run the required student / teacher workflow
```

---

# Testing and Quality Assurance

TypeTrace uses multiple verification layers rather than relying on a single test tool.

## Backend

- Python `unittest`
- FastAPI `TestClient` / HTTPX API tests
- `unittest.mock` and deterministic test doubles
- Coverage.py with branch coverage enabled
- Deterministic scoring regression tests
- Model-architecture regression tests
- Score-fusion regression tests
- Production ML-artifact smoke testing
- Redis integration tests
- Database migration validation

The latest backend coverage artifact included in the reviewed repository reports:

| Metric | Recorded result |
| --- | ---: |
| Statement/line coverage | 93.76% |
| Branch coverage | 87.93% |
| Combined Coverage.py result | **92.28%** |

The coverage configuration measures runtime `app/` code and deliberately excludes the offline ML training modules from the runtime coverage denominator.

## Frontend

- Vitest
- React Testing Library
- JSDOM
- V8 coverage via `@vitest/coverage-v8`
- ESLint
- TypeScript compile checking
- Vite production build validation

The authoritative generated frontend coverage output is written to:

```text
frontend/coverage/
```

Generated coverage output is intentionally not treated as source code and should not be committed.

## Browser / E2E / Responsive / Accessibility

Playwright is used for real-browser automation, including:

- Chromium / Desktop Chrome
- Firefox
- WebKit / Desktop Safari engine
- Pixel 5 responsive profile
- iPad Mini responsive profile
- Authentication and full workflow testing
- Student and teacher workflows
- Public certificate verification
- Editor capture behavior
- Responsive layouts
- Keyboard/accessibility assertions

### Useful commands

Basic repository quality gate on Windows PowerShell:

```powershell
.\run_quality_gate.ps1
```

Broader quality gate:

```powershell
.\run_quality_gates.ps1
```

Comprehensive Python-driven coverage workflow:

```bash
python run_comprehensive_test_coverage.py
```

Full browser suite as part of the comprehensive workflow:

```bash
python run_comprehensive_test_coverage.py --run-full-browser-suite
```

Frontend-only commands:

```bash
cd frontend
npm run test
npm run test:coverage
npm run lint
npm run build
npm run test:e2e:public
```

For authenticated Playwright workflows, configure `frontend/.env.e2e` from `frontend/.env.e2e.example`. The real `.env.e2e` and Playwright authentication-state files are sensitive test material and must not be committed.

---

# Core Demonstration Flow

A concise project demonstration can use the following sequence:

1. Open the public TypeTrace landing page.
2. Register or sign in as a student.
3. Join a teacher course using an invite code, if demonstrating the academic workflow.
4. Start a new writing session.
5. Type and revise a short document in the monitored editor.
6. Save/recover a draft if draft management is part of the demonstration.
7. End and analyze the session.
8. Open the generated session result and certificate.
9. Replay the writing process.
10. Open **Course Management** to view the course-linked submission and teacher feedback state.
11. Verify the certificate through the public verification page.
12. Sign in as the teacher and review the enrolled student's submission.
13. Record teacher review status / feedback and return to the student's course detail view.

---

# Design System

The frontend uses centralized project colors defined in:

```text
frontend/src/styles/colors.ts
```

UI conventions include:

- Clean academic SaaS-style layouts
- Shared layout and UI components
- Consistent spacing and typography
- Icons rather than decorative emoji controls
- Responsive desktop/mobile/tablet behavior
- Clear loading, error, empty and success states
- Review-safe certificate and risk terminology
- Accessible names, form labels, landmarks and keyboard behavior

---

# Security, Privacy and Integrity

TypeTrace handles privacy-sensitive behavioral evidence. Security and privacy are therefore part of the application architecture rather than optional presentation features.

Current safeguards include:

- Password hashing before persistence
- JWT-based authenticated access
- Student and teacher role separation
- OTP and password-reset lifecycle controls
- Rate limiting
- Request-body limits
- Security headers
- Encrypted writing content and keystroke evidence at rest
- Evidence/document hashing
- Canonical evidence generation
- Replay-integrity validation
- Signed certificate records
- Certificate verification / revocation support
- Privacy-controlled public certificate fields
- User data-export and account-deletion workflows
- Audit logging for important evidence/certificate actions

### Public verification privacy

Public certificate verification is intentionally different from an authenticated student or teacher session view. Public endpoints should expose only the fields required to verify the certificate and should not reveal the student's private writing evidence.

---

# Repository Hygiene

Do not commit or distribute runtime secrets or generated output, including:

```text
.env
backend/.env
frontend/.env.e2e
frontend/playwright/.auth/
backend/.coverage
backend/coverage-html-app/
frontend/coverage/
frontend/dist/
frontend/playwright-report/
frontend/test-results/
__pycache__/
*.pyc
venv/
node_modules/
```

ML production artifacts are part of the application's controlled model contract and should not be casually regenerated or replaced without repeating model validation.

---

# Academic and Ethical Positioning

TypeTrace is a final-year software engineering and research project combining:

- Full-stack web engineering
- Behavioral biometrics
- Timing-based anomaly detection
- Machine-learning inference
- Academic-integrity workflows
- Cryptographic integrity controls
- Human-computer interaction
- Privacy-aware application design
- Automated software testing

The project should be evaluated as a working academic SaaS-style prototype rather than a production institutional disciplinary system.

### Correct claim

```text
TypeTrace provides behavioral authorship evidence that can support academic review.
```

### Claim to avoid

```text
TypeTrace proves with absolute certainty that a document was written by a human.
```

A valid TypeTrace certificate demonstrates the state and integrity of the TypeTrace evidence record. It should be interpreted together with academic context and human review.

---

# License / Use

This repository was developed as part of an academic final-year project.

Commercial use, institutional deployment or public production release should only be considered after additional operational security review, privacy/legal review, deployment hardening and independent validation appropriate to the target environment.

---

# Author & Project Information

<p align="center">
  <strong>Simthass MYM</strong><br />
  BSc Computer Science<br />
  University of Bedfordshire
</p>

<p align="center">
  <strong>Final Year Project</strong><br />
  <em>TypeTrace - Behavioral Authorship Verification for Academic Writing</em>
</p>

<p align="center">
  Designed and developed as an academic software engineering and research project focused on transparent, privacy-aware behavioral authorship evidence.
</p>
