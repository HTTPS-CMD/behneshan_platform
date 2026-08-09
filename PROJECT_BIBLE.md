# PROJECT_BIBLE.md

## 1. Project Vision

* **Business Goals**: Build a scalable, enterprise-grade business directory platform ("Behneshan") enabling businesses to register, verify, and manage their digital presence.
* **Long-term Roadmap**: Scale to multi-city operations, integrate premium subscription tiers, implement advanced analytics, and deploy a robust search/discovery engine.
* **Functional Requirements**: Multi-tenant business management, OTP-based secure authentication, dynamic taxonomy (categories/locations), and responsive public-facing directory.
* **Non-functional Requirements**: High performance (Next.js 15), scalable data handling (Django 5/PostgreSQL), mobile-first responsive design, and enterprise security (JWT/RBAC).

## 2. Current Progress

* **Completed Phases**: Env setup, Database schema, OTP Auth system, Taxonomy infrastructure, Business CRUD API, Dashboard integration.
* **Current Phase**: Dynamic Routing for Business Detail pages.
* **Next Phase**: Business Profile Edit functionality and Owner Authorization.
* **Pending Tasks**: Search/Filter implementation, User Review system, Image Uploads.
* **Known Issues**: Minor Pylance linting warnings regarding class name resolution (handled via explicit local definitions).

## 3. Technology Stack

* **Frontend**: Next.js 15 (App Router), Tailwind CSS 4.x, TanStack Query, Zustand, Axios.
* **Backend**: Django 5.0, Django Rest Framework (DRF), PostgreSQL 16, Redis (for caching/sessions).
* **Environment**: macOS (Development), Node.js 22+, Python 3.13.

## 4. Complete Folder Structure

* **/backend**:
* `/apps/identity`: Handles custom User model, JWT, and OTP logic.
* `/apps/taxonomy`: Core data structures for Categories and Locations.
* `/apps/directory`: Business logic, CRUD operations, and detail views.


* **/frontend**:
* `/src/app`: App router structure; `/business/[slug]` handles dynamic details.
* `/src/store`: Zustand stores for Auth and Global UI state.



## 5. System Architecture

* **Communication**: Frontend acts as a client consuming RESTful endpoints from Django via Axios/TanStack Query. Authentication is maintained via JWT stored in secure cookies.

## 6. Database Design

* **Identity.User**: `id`, `phone_number` (unique), `is_verified`.
* **Taxonomy.Category**: `id`, `name`, `slug` (unique index).
* **Taxonomy.Location**: `id`, `name`, `slug` (unique index).
* **Directory.Business**: `id`, `name`, `slug` (unique index), `owner` (FK), `category` (FK), `location` (FK), `description`, `created_at`.

## 7. API Documentation

* `POST /api/v1/identity/otp/`: Requests/Verifies OTP.
* `GET /api/v1/directory/businesses/`: List all businesses.
* `GET /api/v1/directory/businesses/me/`: Authenticated owner list.
* `GET /api/v1/directory/businesses/<slug>/`: Detailed view for specific business.
* `POST /api/v1/directory/businesses/`: Create new listing.

## 8. Frontend Architecture

* **State**: Zustand for Auth persistence; TanStack Query for caching API fetches.
* **Routing**: Next.js App Router; Dynamic routing enabled via `[slug]` convention.
* **Design**: Tailwind CSS utility-first; Mobile-first breakpoint strategy.

## 9. Backend Architecture

* **Models**: Standard Django ORM models.
* **Serializers**: DRF `ModelSerializer` used to map API output, handling nested relationships for Categories and Locations.
* **Views**: Generic API Views (`RetrieveAPIView`, `ListAPIView`) for optimized read operations.

## 10. Infrastructure

* **Persistence**: PostgreSQL for structured data; Redis for session/OTP volatile storage.
* **Strategy**: Local development on macOS using `venv` and `npm`; production target is containerized deployment (Docker).

## 11. Coding Standards

* **Naming**: CamelCase for React components; snake_case for Python/DB.
* **Commits**: Conventional commits (e.g., `feat:`, `fix:`, `refactor:`).
* **Error Handling**: Centralized try-catch for API requests; standardized DRF exception handling for API.

## 12. Responsive Rules

* Use `md:` and `lg:` prefixes in Tailwind. Ensure touch-target sizes are at least 44x44px for mobile.

## 13. Security

* **Auth**: JWT (JSON Web Tokens) with short-lived access tokens.
* **Protection**: CSRF tokens enabled for all mutating requests; input validation via DRF Serializers.

## 14. AI Integration Plan

* Future modules: AI-generated business descriptions, image categorization using automated vision tasks, and chatbot-based customer inquiry responses.

## 15. Development Workflow

* Changes must be tested on the local dev server (`runserver`). Frontend updates require `npm run dev`.

## 16. Current File Status

* **Created**: `apps/directory/views.py`, `apps/directory/serializers.py`, `src/app/business/[slug]/page.tsx`.
* **Pending**: `BusinessUpdateSerializer`, `EditBusinessForm` component.

## 17. Current TODO List

1. (High) Implement `BusinessUpdateSerializer`.
2. (High) Add `UpdateAPIView` to `directory/views.py`.
3. (Med) Build owner-only edit form in the dashboard.

## 18. Exact Resume Point

"If another Gemini session receives this file, it must continue exactly from this point and must not restart architecture or planning."