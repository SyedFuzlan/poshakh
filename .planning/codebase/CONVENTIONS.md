# Conventions

## Coding Standards
- **JavaScript/TypeScript**: Standard ESM and CommonJS usage depending on directory.
- **Naming**:
  - Files: kebab-case.
  - Variables/Functions: camelCase.
  - Components: PascalCase.
  - Constants: UPPER_SNAKE_CASE.

## Backend Patterns
- **Route Handlers**: Use Zod for request validation.
- **Middleware**: `requireOwner` for admin-only routes.
- **Logging**: Always use the custom `logger` for errors and key events.

## Frontend Patterns
- **Hooks**: Logic separated from UI into custom hooks.
- **Styling**: Tailwind CSS for utility-first styling.
