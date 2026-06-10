<p align="center">
  <img src="./frontend/public/Logo.png" alt="TypeTrace Logo" width="220" />
</p>

<p align="center">
  Behavioral authorship verification for academic writing.
</p>

<p align="center">
  TypeTrace records the writing process - keystrokes, pauses, revisions, paste events, and timing patterns - to produce verifiable authorship evidence for academic review.
</p>

---

## Overview

TypeTrace is a full-stack academic integrity system designed to support students and educators in authorship verification. Instead of judging only the final submitted text, TypeTrace captures behavioral writing evidence during the writing session itself.

The system allows students to write inside a monitored editor, records behavioral signals such as typing rhythm and revision activity, analyzes the session, and generates a certificate that can be verified through a public verification page.

TypeTrace is not designed to replace academic judgement. It is designed to provide structured, transparent, and reviewable evidence that can support fair authorship assessment.

---

## Core Problem

AI-generated text detection systems often evaluate only the final written output. This creates a risk of false accusations, especially for students whose writing is formal, technical, or non-native in style.

TypeTrace approaches the problem differently:

* It records how the work was produced.
* It captures behavioral evidence during the writing process.
* It generates a certificate linked to the recorded session.
* It gives educators a reviewable audit trail instead of relying only on final-text detection.

---

## Core Capabilities

### Student Workflow

* Student registration and OTP verification
* Secure login and session persistence
* Writing session creation
* Keystroke and behavioral event capture
* Pause, deletion, paste, and timing analysis
* Session completion and analysis
* Certificate generation
* Public certificate verification

### Teacher Workflow

* Teacher registration and login
* Teacher dashboard
* Course management
* Student enrollment through invite codes
* Review of enrolled student submissions
* Access to certificate and audit evidence

### Verification Workflow

* Certificate ID generation
* Document integrity hash
* Public verification endpoint
* Certificate PDF download
* Risk and confidence indicators
* Review-safe wording for academic use

---

## Technology Stack

| Layer                  | Technology                  |
| ---------------------- | --------------------------- |
| Frontend               | React, TypeScript, Vite     |
| Styling                | Tailwind CSS                |
| Routing                | React Router                |
| State Management       | Zustand                     |
| Backend                | FastAPI                     |
| Database               | PostgreSQL                  |
| Cache / OTP Store      | Redis                       |
| ORM                    | SQLAlchemy                  |
| Migrations             | Alembic                     |
| Authentication         | JWT                         |
| Machine Learning       | scikit-learn, NumPy, Pandas |
| Certificate Generation | ReportLab                   |
| Container Support      | Docker Compose              |

---

## Project Structure

```text
TypeTrace/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── ml/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── migrations/
│   ├── requirements.txt
│   └── alembic.ini
│
├── frontend/
│   ├── public/
│   │   └── Logo.png
│   ├── src/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── styles/
│   │   └── types/
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Prerequisites

Install the following before running the project:

* Node.js 20 or later
* npm
* Python 3.11 or later
* PostgreSQL 15 or later
* Redis 7 or later
* Docker Desktop, optional but recommended
* Git

---

## Environment Setup

Create a local environment file from the example:

```bash
copy .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Update the values in `.env` if your local PostgreSQL or Redis configuration is different.

The backend expects PostgreSQL and Redis to be available before startup.

---

## Running Infrastructure with Docker

From the project root:

```bash
docker compose up -d
```

This starts:

* PostgreSQL database
* Redis cache

To stop the services:

```bash
docker compose down
```

To remove database volume data:

```bash
docker compose down -v
```

Use the volume removal command carefully because it deletes local database data.

---

## Backend Setup

Open a terminal in the backend folder:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv venv
```

On Windows PowerShell:

```bash
.\venv\Scripts\activate
```

On macOS or Linux:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run database migrations:

```bash
alembic upgrade head
```

Start the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "TypeTrace API"
}
```

---

## Frontend Setup

Open a second terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

The frontend development server usually runs at:

```text
http://localhost:5173
```

---

## Development Workflow

Recommended startup order:

```text
1. Start PostgreSQL and Redis
2. Start the FastAPI backend
3. Start the React frontend
4. Confirm frontend and backend are connected
5. Run the main student and teacher workflows
```

Recommended verification commands:

```bash
docker compose ps
```

```bash
curl http://127.0.0.1:8000/api/v1/health
```

```bash
cd frontend
npm run build
```

---

## Core Demo Flow

Use this flow when demonstrating the project:

1. Open the public landing page.
2. Register or login as a student.
3. Start a writing session.
4. Type a short paragraph inside the editor.
5. End and analyze the session.
6. Generate a certificate.
7. Open the public verification page.
8. Login as a teacher.
9. Review enrolled student evidence.
10. Open the audit or replay view.

---

## Design System

The frontend uses a centralized color system.

All project colors must be imported from:

```text
frontend/src/styles/colors.ts
```

Do not hardcode hex values directly inside components unless the value is part of a deliberate external asset or browser overlay.

Preferred UI principles:

* Clean academic SaaS layout
* Consistent spacing and typography
* Professional buttons, cards, tables, forms, and empty states
* Icons instead of emojis
* Clear loading, error, and success states
* Careful certificate wording without exaggerated claims

---

## Security and Privacy Position

TypeTrace handles behavioral writing data. The system must therefore be treated as privacy-sensitive.

Implementation principles:

* Passwords are hashed before storage.
* JWT is used for authenticated access.
* Student and teacher roles are separated.
* Private session data should not be exposed through public verification.
* Public certificates should present verification evidence, not full writing content.
* Behavioral results should be interpreted as supporting evidence, not final disciplinary proof.

---

## Academic Positioning

TypeTrace is a final-year software engineering and research project. It combines:

* Full-stack web development
* Behavioral biometrics
* Machine learning
* Academic integrity workflows
* Cryptographic verification
* Human-computer interaction
* Privacy-aware system design

The project should be evaluated as a working academic SaaS-style prototype, not as a commercial production platform.

---


## Important Notes

TypeTrace should not claim to prove authorship with absolute certainty.

TypeTrace is:

```text
TypeTrace provides behavioral authorship evidence that can support academic review.
```

Not:

```text
TypeTrace proves that a document was written by a human.
```

This distinction is important for ethical, academic, and legal defensibility.

---

## License

This project is developed as part of an academic final-year project.

Commercial use, institutional deployment, or public release should only be considered after further security review, privacy review, and validation testing.

---

## Author

**Simthass MYM** | BSc Computer Science | University of Bedfordshire
