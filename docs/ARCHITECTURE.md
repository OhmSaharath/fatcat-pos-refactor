# 🏛️ Architecture & Coding Standards Guide (Phase 2)

Welcome to **FATCAT POS (Phase 2 Refactor)**. This document explains the codebase design, programming paradigm, and conventions so any engineer or contributor can immediately navigate and build upon this project.

---

## 1. Why Not Classic OOP Classes in Frontend? (React Modern Standard)
If you come from Java, C#, or old-school JavaScript, you might look for `class DishComponent extends Component`.
In modern web development (React 18+ / 19), **Class-based OOP was replaced by Functional Components with Custom Hooks**:

### ❌ Old OOP Pattern:
- Heavy lifecycle methods (`componentDidMount`, `componentWillUnmount`).
- Complex `this` binding and mutable state.
- Hard to share logic between multiple components without high-order wrappers.

### ✅ Modern Functional & Component-Driven Pattern:
- **Pure Declarative UI**: Components receive `props` and render HTML/Tailwind styling without hidden side-effects.
- **Custom Hooks for Business Logic**:
  - `useCart()` encapsulates cart addition, modifier calculations, discounts, and `localStorage` caching.
  - `useMenu()` encapsulates Loyverse menu fetching, search filtering, and category grouping.
- **Lego-Block Composability**: Any engineer can create a new UI without touching core business logic, or test business logic without rendering the UI.

---

## 2. Backend Architecture: Layered Service-Repository Pattern
Instead of one massive 2,000-line server script with global variables, backend code is divided into 4 clear layers:

```
[ Client / Frontend ]
         │ (HTTP REST)
         ▼
[ 1. API Layer (Routers) ]       ── app/api/*.py
         │
         ▼
[ 2. Service Layer (Business Logic) ] ── app/services/*.py
         │ (Loyverse, SlipOK, PromptPay)
         ▼
[ 3. Storage Layer (Repository) ]     ── app/storage/state_repository.py
         │
         ▼
[ 4. Persistent Store (db.json / store_state.json) ]
```

1. **API Layer (`app/api/`)**:
   - Only responsible for receiving HTTP requests, validating request bodies, and returning clean JSON.
   - Example: `menu_routes.py`, `order_routes.py`, `admin_routes.py`.
2. **Service Layer (`app/services/`)**:
   - Contains pure business logic.
   - Example: `LoyverseService` manages communication with Loyverse POS API; `SlipService` verifies bank transfer slips.
3. **Storage Layer (`app/storage/`)**:
   - Manages state reading/writing with thread safety, preventing concurrent race conditions.
4. **Models / Schemas (`app/models/`)**:
   - Defines strict data types for dishes, modifiers, orders, and receipts.

---

## 3. Typography & Styling Guidelines
- **English & Numerals**: **`Inter`** (clean, high x-height, tabular figures).
- **Thai**: **`IBM Plex Sans Thai`** (lean, legible loops, modern delivery app style).
- **CSS Framework**: **Tailwind CSS** with design tokens for Chipotle gourmet brown (`#451400`), active red (`#C4121A`), and warm ochre (`#A8622D`).

---

## 4. Git & Commit Guidelines
Every modification must be documented in [CHANGELOG.md](../CHANGELOG.md) with:
1. Feature / task summary.
2. Modified files and components.
3. Verification / testing steps performed.
