## 2024-05-22 - Missing ARIA labels on Icon-only Buttons
**Learning:** The application frequently uses `lucide-react` icons inside `Button` components (variant="ghost", size="icon") without providing `aria-label` attributes. This makes these actions inaccessible to screen reader users.
**Action:** When using icon-only buttons, always include a descriptive `aria-label` explaining the action (e.g., "Clear filters", "View details").
