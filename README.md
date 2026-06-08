# TypeTrace

**Keystroke biometric analysis for verifying academic authorship.**

TypeTrace captures how you type — not just what you type — to verify authentic student authorship using keystroke dynamics and machine learning.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| Build | Vite |
| Routing | React Router v6 |
| Backend | FastAPI (Python 3.11) |
| Database | PostgreSQL 15 |
| ML | scikit-learn (Random Forest) |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── layout/          # Header, Footer, RootLayout
│   └── ui/              # Reusable UI primitives
├── constants/           # Routes, config constants
├── hooks/               # Custom React hooks
├── pages/               # Page-level components
├── styles/
│   └── colors.ts        # Brand color system (single source of truth)
└── types/               # TypeScript type definitions
```

## Brand Colors

All colors are defined in `src/styles/colors.ts`. Import from there — never hardcode hex values in components.

```ts
import { colors, brand } from '../styles/colors'
```

## Logo

Place your logo file in `/public/logo.svg` (or `logo.png`). The header and footer will pick it up automatically.

---

*Built for academic integrity. Developed with React, FastAPI, and scikit-learn.*
