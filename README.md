# 🅿️ Parkly — Smart City Decentralized Parking Marketplace

> **"Find, reserve, and navigate to your parking spot before you even turn on your ignition."**  
> Built by **ZEUS Technologies** · Initial Launch Market: **Chennai, Tamil Nadu, India 🇮🇳**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![AWS Cloud Native](https://img.shields.io/badge/AWS-Cloud%20Native-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

---

## 🌟 Executive Overview

**Parkly** is an AI-powered, decentralized smart parking marketplace that eliminates urban parking friction. By aggregating underutilized private driveways, residential society slots, and commercial complexes, Parkly converts idle real estate into guaranteed, bookable parking inventory for drivers while unlocking passive income for property owners.

---

## 📚 Complete Project Documentation Suite

The project architecture, business validation, and software planning have been codified into an authoritative documentation suite:

| Document | Description |
|---|---|
| 📘 [**PARKLY MASTER DOCUMENTATION**](file:///e:/Github/Parkly/PARKLY_MASTER_DOCUMENTATION.md) | **Single Source of Truth (SSoT)** integrating purpose, USP, startup validation, ideology, architecture, and sprint plan. |
| 🎯 [**01. Project Purpose & Ideology**](file:///e:/Github/Parkly/docs/01_PROJECT_PURPOSE_AND_IDEOLOGY.md) | The urban parking crisis, mission statement, core philosophy, and 3-horizon growth vision. |
| 💡 [**02. USP & Startup Validation**](file:///e:/Github/Parkly/docs/02_USP_AND_STARTUP_VALIDATION.md) | Unique selling proposition, TAM/SAM/SOM market sizing, customer personas, unit economics, and GTM strategy. |
| 🏗️ [**03. System Architecture Design**](file:///e:/Github/Parkly/docs/03_SYSTEM_ARCHITECTURE.md) | Cloud-native architecture topology, microservices boundaries, EventBridge event choreography, and security baselines. |
| 🛠️ [**04. Tech Stack & Tooling**](file:///e:/Github/Parkly/docs/04_TECH_STACK_AND_TOOLS.md) | React Native (Expo), React 18/Vite, Node.js/TypeScript, PostgreSQL, DynamoDB, AWS CDK, and testing frameworks. |
| 🗄️ [**05. Database Schema & Data Models**](file:///e:/Github/Parkly/docs/05_DATABASE_SCHEMA_AND_MODELS.md) | Full ERD diagrams, 12 relational Prisma models, 11 enums, DynamoDB tables, and concurrency state machines. |
| 🔌 [**06. Core Services & API Specs**](file:///e:/Github/Parkly/docs/06_CORE_SERVICES_AND_API_SPEC.md) | Standardized REST contracts for Auth, Search, Booking, Payments, Host, Occupancy, Pricing, and Admin services. |
| 🚀 [**07. Software Development Roadmap**](file:///e:/Github/Parkly/docs/07_SOFTWARE_DEVELOPMENT_PLAN_AND_ROADMAP.md) | Phased product roadmap, Sprint 0 to Sprint 7 backlog, Definition of Done, and engineering milestones. |
| 🤖 [**08. AI Multi-Agent Architecture**](file:///e:/Github/Parkly/docs/08_AI_AGENT_ARCHITECTURE.md) | Autonomous multi-agent ecosystem for onboarding, vision inspection, predictive vacancy, pricing, concierge, and disputes. |

---

## 🏗️ High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SURFACES                      │
│   📱 Driver App (Expo RN)  🖥️ Host Dashboard  🔧 Admin Portal│
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS (TLS 1.3)
┌──────────────▼──────────────────────────────────────────────┐
│                  AWS CloudFront / API Gateway                │
│   Rate Limiting · JWT Validation · Route Optimization       │
└──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───────────────────────┘
   │   │   │   │   │   │   │   │   │   │
   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼
  Auth Book Pay Srch Pred Host Occ  Prc  Notif Admin
   │                               │
   ▼                               ▼
PostgreSQL (RDS 16)          DynamoDB (OTP/Occupancy/Notifs)
   │
   └────────────► Amazon EventBridge (Async Event Bus) ──► Analytics Data Lake
```

---

## 🚦 Roadmap: Building From Scratch

The codebase is prepared for clean-slate engineering starting from **Sprint 0**:

- [ ] **Sprint 0**: Monorepo scaffolding, TypeScript configs, Docker dev infra, and `@parkly/shared` core library.
- [ ] **Sprint 1**: PostgreSQL database migrations (Prisma), seed data, and Auth Service (Phone + OTP + JWT).
- [ ] **Sprint 2**: Host space onboarding and Geospatial Search Service with Geohash indexing.
- [ ] **Sprint 3**: Booking concurrency engine (`FOR UPDATE` atomic locking) and UPI payment integration.
- [ ] **Sprint 4**: Driver Mobile App (React Native Expo) with interactive map, vehicle picker, and checkout.
- [ ] **Sprint 5**: Host Web Dashboard (React 18 + Vite) with listing management and earnings analytics.
- [ ] **Sprint 6**: Admin Portal with host KYC verification workflows and dispute management.
- [ ] **Sprint 7**: Real-time IoT occupancy ingestion, dynamic pricing, and AWS CDK production cloud deployment.

---

## 📄 License & Intellectual Property

Proprietary — Developed by **ZEUS Technologies**. All rights reserved.
