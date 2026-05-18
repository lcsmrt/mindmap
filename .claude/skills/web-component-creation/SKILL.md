---
name: web-component-creation
description: Creates reusable React components with a standardized architecture based on separation of concerns, styling conventions, and accessibility guidelines. Use when creating new UI components or refactoring existing ones in React applications.
---

# Component Creation Skill

This project builds components as **named arrow function exports** with **typed props** and **`cn`-based className merging** using Tailwind CSS.

Base UI primitives (buttons, inputs, dialogs, etc.) come from **shadcn/ui** (`src/components/ui/`) and are treated as third-party code — do not modify, refactor, or enforce project conventions on them. This skill covers **custom components** built for the application.

## Component Location

All custom components live in `src/components/`. There is no `features/` folder structure yet — if the project grows to the point where feature isolation makes sense, extract at that time.

shadcn/ui primitives live in `src/components/ui/` and are never modified.

---

## Architecture Overview

1. **Anatomy** — props type, arrow function, named export, `cn` merging. See `references/anatomy.md`.

2. **Variants** — style variants with `cva` and `VariantProps`. See `references/variants.md`.

3. **Compound patterns** — static siblings for structural composition; context-based for shared state. See `references/compound-patterns.md`.

---

## Usage Guidance

Use this skill when:

- Creating a new shared UI component in `src/components/`
- Adding style variants to an existing component
- Composing a compound component (e.g. card with header/body/footer)
- Deciding how to structure a component with multiple visual states

Always follow the reference patterns before introducing custom variations.
