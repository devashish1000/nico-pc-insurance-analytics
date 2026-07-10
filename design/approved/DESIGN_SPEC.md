# NICO P&C Insurance Analytics — accepted design specification

Accepted desktop reference: `nico-desktop-approved.png` (1536×1024)

Accepted mobile reference: `nico-mobile-approved.png` (853×1877)

## Visual system

- Ink navy `#061f3d` / `#0b2c52` for the header, navigation rail, primary actions, and chart bars.
- Paper ivory `#fbf8f1` for the hero and page canvas; true white is reserved for data surfaces.
- Antique gold `#c38a21` for hairlines, active navigation, and editorial accents.
- Emerald `#087f53`, oxblood `#b4232f`, and amber `#a95a00` are semantic status colors.
- Display headings use an editorial serif; UI chrome and dense data use a neutral sans serif.
- Data surfaces use 0–6px radii, thin borders, and minimal elevation. Avoid rounded SaaS card walls.

## Layout contract

- The first viewport begins with a quiet navy header and a full-width editorial hero.
- Hero copy and persona choices remain code-native. The pipeline diagram is also code-native.
- Desktop dashboard uses a 240px navy navigation rail and an open content canvas.
- Mobile is a real single-column layout with a compact header, two persona controls, an Explore menu,
  two-column KPI summary, and no page-level horizontal overflow.
- Tables may scroll inside a bounded wrapper; charts must resize to the viewport.

## Allowed hero copy

- P&C Insurance Analytics Platform
- Built for the NICO Data Warehouse team.
- A live, synthetic-data work sample spanning warehouse engineering, quality controls, rating logic,
  and testable requirements.
- Explore as a Data Engineer
- Explore as a Business Analyst
- Synthetic data · no PII
- Source

## Component rules

- Icons use a consistent thin outline style.
- Buttons are rectangular with 4–6px corners and a minimum mobile tap height of 44px.
- Persona selection is persistent and changes navigation order without duplicating page content.
- Motion is limited to short fades, progress transitions, and tour steps; respect reduced motion.
- The generated shield/chart mark is inspiration only; production uses a distinct project-owned SVG mark.

