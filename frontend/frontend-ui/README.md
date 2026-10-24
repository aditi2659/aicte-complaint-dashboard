# AICTE Integrated Institution Complaint Monitoring & Status Portal (IICMD)

A comprehensive, production-grade frontend prototype for the **All India Council for Technical Education (AICTE)** to monitor institution-related complaints across multiple bureaus and cells:
- **Regulation Bureau (RB)**
- **Public Grievance Redressal Cell (PGRC)**
- **Approval Bureau (AB)**
- **Policy & Academic Planning Bureau (PAPB)**
- **Faculty Development Bureau (FDB)**
- **Skill Development Cell (SDC)**

Built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **React Router 7**, **Recharts**, and **Lucide React**, incorporating a modern, technology-focused visual theme with **emerald green** and **electric pink** accents with pixel-inspired detailing.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm

### 2. Installation & Running
The project is located at:
```bash
C:\Users\vibha kadam\.gemini\antigravity\scratch\aicte-complaint-portal
```

To run the application:
```bash
cd "C:\Users\vibha kadam\.gemini\antigravity\scratch\aicte-complaint-portal"
npm install
npm run dev
```

Open your browser at:
```
http://127.0.0.1:5173/
```

To create a production build:
```bash
npm run build
```

---

## 🏛️ System Modules & Features

### 1. Executive Oversight Dashboard (`/`)
- **Realtime KPIs**: Total Ingested Complaints, Pending, Under Process, Disposed, Transferred, SLA Overdue, and Open Overlap Flags.
- **Interactive Bureau-Wise Workload Chart**: Recharts bar chart showing complaints broken down by bureau. Clicking any bureau column directly filters the Complaint Registry.
- **Monthly Intake vs. Disposal Trajectory**: Dual-area chart comparing new case registrations against final dispositions over 6 months.
- **Operational Status Distribution**: Donut chart with interactive slice filtering.
- **Live Activity Feed**: Realtime stream of hearings, notices, and status changes across AICTE divisions.
- **High-Priority Alert Banner**: Prominently highlights cross-bureau overlap flags requiring human review.

### 2. National Complaint Registry (`/complaints`)
- Comprehensive multi-bureau table with:
  - Readable case numbers (e.g., `AICTE/RB/2026/0412`, `AICTE/PGRC/2026/0891`)
  - Respondent institution & AICTE Permanent ID (PID)
  - Category and subject line
  - Bureau custody tag (`RB`, `PGRC`, `AB`, `PAPB`, `FDB`, `SDC`)
  - Assigned inquiry officer
  - Calculated statutory SLA due date and dynamic overdue indicators
  - Official status (`RECEIVED`, `PENDING`, `UNDER_PROCESS`, `TRANSFERRED`, `ESCALATED`, `DISPOSED`)
- **Functional Multi-Axis Filters**: Search query, Bureau, Operational Status, Geographic Region, Complaint Category, Assigned Officer, and a quick **"Overdue Cases Only"** toggle.
- **Sorting & Pagination**: Full column sorting (case number, due date, registration date, institution) and responsive pagination.
- **CSV Data Export**: One-click download of the filtered complaint table in `.csv` format.
- **Interactive Action Workflows**:
  - *Register Complaint Modal*: Full validation, automated case number generation, and initial timeline logging.
  - *Update Status Modal*: Status transition with mandatory official hearing remarks.
  - *Bureau Transfer Modal*: Target division selection, transfer rationale, and inter-bureau handover directives.
  - *Reassign Officer Modal*: Workload rebalancing within or across bureaus.

### 3. Cross-Bureau Overlap Detection Centre (`/overlaps`)
*Key Differentiating Feature of the Platform*
- **Problem Solved**: Unifies cases filed under different silos (e.g. faculty complaining about 6-month salary arrears to Regulation Bureau, while students complain about suspended lectures and unpaid faculty walkout to PGRC).
- **Heuristic Indicators**: Similarity score (0–100%), institution Permanent ID matching, and taxonomy classification.
- **Side-by-Side Comparison Inspector**: Full dual-column comparison of Case A vs. Case B showing complainant types, lodgment dates, assigned officers, and comprehensive grievances.
- **Human-in-the-Loop Safeguards**:
  - **Confirm Related**: Links cases for joint committee scrutiny and shared evidence without altering statutory autonomy (no destructive auto-merging).
  - **Dismiss Match**: Explanatory review notes recorded in audit trail for non-relevant matches.
- **Filter Tabs**: Unreviewed, Confirmed Related, and Dismissed overlap pairs.

### 4. Comprehensive Case Dossier & Timeline (`/complaints/:id`)
- Complete case metadata, institution profile link, complainant category (Student, Faculty, Parent, Citizen, Whistleblower), and lodging channel.
- Evidentiary document repository simulation with download placeholders.
- **Chronological Action Timeline**: Immutable chronological sequence of statutory notices dispatched, conciliation hearings scheduled, on-site inspections ordered, and disposal decrees.
- **Interactive Action Logger**: Allows officers to enter hearing minutes or inquiry findings directly onto the dossier.

### 5. Institution Master Directory & Profile (`/institutions` & `/institutions/:id`)
- Master listing of approved technical institutions with AICTE Permanent ID, state, region, and regulatory standing.
- **Institution Profile View**:
  - Institutional attributes, approved intake, accreditation (NAAC / NBA), and contact information.
  - Institutional complaint metrics and resolution efficiency percentage.
  - Complete cross-bureau historical complaint table filtered specifically for the institution.
  - Overlap alerts involving the institution.
  - Shortcut to lodge a new complaint against the institution with pre-filled ID.

### 6. Analytics & Administrative Audit (`/reports` & `/admin`)
- **Reports**:
  - Bureau performance matrix with total cases, active inquiries, overdue flags, and disposal rates.
  - Statutory pending grievance ageing analysis (`< 15 days`, `15–30 days`, `30–60 days`, `> 60 days`).
  - Geographic regional concentration chart.
  - Executive report generation simulation.
- **Admin**:
  - **Immutable Audit Trail Table**: Records timestamp, user, role, bureau, action event, entity target, narrative, and client IP.
  - **Role-Based Access Control (RBAC)**: Bureau Head, Complaint Officer, CVO, and Super Admin permissions matrix.
  - **Persona Switcher**: Topbar dropdown allows testing the application from different roles (Dr. Ramesh Chandra - RB Head, Prof. Ananya Sen - PGRC Director, Col. R. K. Sharma - Chief Vigilance Officer, Col. B. Venkat - Member Secretary).
  - **Future Roadmap Placeholders**: Structured placeholders for Jan Parichay SSO, Aadhaar e-Sign, and NIC PostgreSQL connectors.

---

## 🎨 Visual Identity & Styling
- **Color Palette**:
  - **Main background**: `#101713` (deep forest charcoal)
  - **Card and panel background**: `#1A241D` (subtle green-tinted panels)
  - **Elevated surfaces**: `#222F25` (inputs, elevated controls, dialog headers)
  - **Primary accent**: `#C4F279` (electric lime green) - primary actions, selected navigation, positive indicators, and key chart metrics
  - **Secondary accent**: `#FF8BCB` (soft neon pink) - cross-bureau overlap flags, related-case links, and review alerts
  - **Main text**: `#E6EFE5` (high contrast, crisp readability)
  - **Secondary text**: `#A6B7A8` (muted metadata, secondary labels)
  - **Borders and dividers**: `#35473A` (restrained structure and boundaries)
- **Pixel-Inspired Detailing**:
  - Crisp square-pixel motifs and status dots (`w-1.5 h-1.5` square indicators)
  - Selected panel corners with crisp square pixel notches (`#C4F279` and `#FF8BCB`)
  - Restrained dotted-grid telemetry pattern (`bg-pixel-grid`, `bg-pixel-dots`)
  - Pixelated institutional brand mark with lime and pink corner notches
  - Clean monospace metadata typography for case dossiers and AICTE Permanent IDs (`font-mono`)

---

## 📦 Project Architecture

```
src/
├── types/
│   └── index.ts                 # Typed domain models (Complaint, Institution, OverlapMatch, etc.)
├── data/
│   └── mockData.ts              # Rich, realistic fictional AICTE dataset
├── context/
│   └── ComplaintContext.tsx     # Central state management with localStorage persistence & audit logging
├── services/
│   └── api.ts                   # Abstracted REST API client boundaries (Express/PostgreSQL ready)
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # Responsive application shell
│   │   ├── Sidebar.tsx          # Main navigation with unreviewed overlap alert badge & demo reset
│   │   └── Topbar.tsx           # Global search, quick register button, persona switcher
│   ├── common/
│   │   ├── Badge.tsx            # StatusBadge, BureauBadge, PriorityBadge, OverlapTag
│   │   ├── Card.tsx             # Pixel-notched container card
│   │   ├── Modal.tsx            # Accessible modal dialog with backdrop blur & ESC handler
│   │   ├── EmptyState.tsx       # Reusable empty state view
│   │   └── SearchInput.tsx      # Debounced search input
│   ├── dashboard/
│   │   ├── StatCard.tsx         # Clickable metric KPI cards
│   │   ├── WorkloadChart.tsx    # Click-to-filter Recharts bureau workload chart
│   │   ├── TrendsChart.tsx      # Monthly registration vs disposal area chart
│   │   ├── StatusPieChart.tsx   # Interactive status donut chart
│   │   └── RecentActivityList.tsx # Live case activity feed
│   ├── complaints/
│   │   ├── ComplaintTable.tsx   # Sortable, paginated complaint registry table
│   │   ├── ComplaintFilters.tsx # Multi-axis filter toolbar
│   │   ├── RegisterComplaintModal.tsx # Complaint registration workflow
│   │   ├── StatusUpdateModal.tsx# Official status transition workflow
│   │   ├── TransferBureauModal.tsx # Inter-bureau handover workflow
│   │   └── ReassignOfficerModal.tsx # Case reassignment workflow
│   ├── overlap/
│   │   ├── OverlapCard.tsx      # Overlap comparison card with confidence rating
│   │   └── OverlapCompareModal.tsx # Full side-by-side inspection & adjudication modal
│   └── institutions/
│       └── InstitutionCard.tsx  # Institution card with standing & metrics
├── pages/
│   ├── DashboardPage.tsx        # Executive dashboard
│   ├── ComplaintRegistryPage.tsx# National complaint registry
│   ├── CaseDetailPage.tsx       # Detailed case dossier & chronological timeline
│   ├── OverlapCenterPage.tsx    # Cross-bureau overlap detection & review
│   ├── InstitutionDirectoryPage.tsx # Master institution directory
│   ├── InstitutionProfilePage.tsx # Detailed institution history & metrics
│   ├── ReportsPage.tsx          # Analytics, ageing analysis & workload matrix
│   └── AdminPage.tsx            # Audit trails, RBAC roles & roadmap placeholders
├── App.tsx                      # Application routing
├── main.tsx                     # React DOM entry point
└── index.css                    # Tailwind CSS v4 entry & custom styles
```

---

*Note: This is a standalone frontend prototype with fictional sample data built for demonstration and evaluation purposes. It is not connected to live AICTE production systems.*
