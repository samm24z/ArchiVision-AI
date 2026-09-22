# ArchiVision AI — Documentation

Welcome to the ArchiVision AI documentation hub.

## Getting Started

| Guide | Description |
|-------|-------------|
| [SETUP.md](./SETUP.md) | Local developer environment setup |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Render deployment (M1) |
| [../README.md](../README.md) | Project overview and quick start |

## Planning Documents (Frozen)

The following specifications are **frozen** and serve as the single source of truth. Do not modify without explicit architectural approval.

| Document | File | Status |
|----------|------|--------|
| Product Vision | [planning/product-vision.md](./planning/product-vision.md) | 🔒 Frozen |
| Product Experience Blueprint | [planning/product-experience-blueprint.md](./planning/product-experience-blueprint.md) | 🔒 Frozen |
| Software Architecture | [planning/software-architecture.md](./planning/software-architecture.md) | 🔒 Frozen |
| Database Design Specification | [planning/database-design-specification.md](./planning/database-design-specification.md) | 🔒 Frozen |
| AI Technical Design Specification | [planning/ai-technical-design-specification.md](./planning/ai-technical-design-specification.md) | 🔒 Frozen |
| Master Development Roadmap | [planning/master-development-roadmap.md](./planning/master-development-roadmap.md) | 🔒 Frozen |

> Planning files currently hold approved summaries. Full long-form copies may be added later without changing decisions.

## Implementation Milestones

| Milestone | Focus | Status |
|-----------|-------|--------|
| M0 | Project initialization | ✅ Complete (frozen) |
| M1 | Deployed application shell | 🔧 Local complete; cloud deploy pending |
| M2 | Auth, profiles, preferences | Pending |
| M3 | Projects foundation | Pending |

See [planning/master-development-roadmap.md](./planning/master-development-roadmap.md) for the full roadmap.

## Directory Layout

```
docs/
├── README.md                          # This file
├── SETUP.md                           # Developer setup guide
├── DEPLOYMENT.md                      # Vercel / Render (M1)
└── planning/                          # Frozen specifications
    ├── README.md
    ├── product-vision.md
    ├── product-experience-blueprint.md
    ├── software-architecture.md
    ├── database-design-specification.md
    ├── ai-technical-design-specification.md
    └── master-development-roadmap.md
```
