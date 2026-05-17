# Requirements Document

## Introduction

This spec covers a from-scratch creative and architectural reimagination of Devansh Barai's personal portfolio website. The current site (audited at `artifacts/portfolio/` in this workspace) is a single-file React + Vite + Tailwind v4 application with a generic "Hero → About → Education → Projects → Ventures → Skills → Contact" layout, heavy glassmorphism, an animated cyan→indigo→pink gradient, aurora blobs, a noise overlay, a typewriter effect on five role labels, percentage progress bars for skills, a global custom cursor with `cursor: none`, and zero handling for `prefers-reduced-motion`. The visual system, layout logic, and structure are explicitly being replaced.

The redesign reimagines the site as a cinematic editorial experience — a living identity system that reads like an interactive narrative rather than a resume or developer landing page. Identity content is preserved and elevated from the canonical résumé: Devansh Barai — a computer science, AI/ML, and product-oriented builder. Devansh holds two co-primary academic affiliations of equal standing: IIT Madras (BS in Data Science and Applications, 2024–2028) and IIM Bangalore (BBA in Digital Business & Entrepreneurship, 2025–2028). Four flagship projects are featured: GlobeID, Khetech, SupportDeskOps-v6, and Last-Minute PDF.

The document defines requirements for creative direction, visual identity, typography, motion, layout and narrative pacing, interaction philosophy, project showcase strategy, content voice, technical architecture, performance budgets, responsive strategy, accessibility, and a set of deterministic correctness properties (content integrity, route mapping, breakpoint contracts, reduced-motion behaviour) suitable for property-based testing.

The design phase that follows this document will choose specific aesthetic and structural directions within these constraints. Requirements describe **what** the system must achieve, not **how** the design will achieve it.

## Glossary

- **Portfolio_Site**: The complete deployed web application, including all pages, sections, assets, and runtime behaviour.
- **Visual_System**: The set of design tokens (color, surface, elevation, spacing, radius, gradient, shadow, atmosphere) that define the look of the Portfolio_Site.
- **Typography_System**: The set of font families, type scale, weights, line heights, letter spacing, and pairing rules used across the Portfolio_Site.
- **Motion_System**: The set of animation primitives (timing functions, durations, choreography rules, scroll-driven effects, micro-interactions) that govern movement in the Portfolio_Site.
- **Layout_Engine**: The structural composition and narrative pacing of the Portfolio_Site — the ordered sequence of scenes, transitions, and rhythms that form the user journey.
- **Project_Showcase**: The dedicated subsystem responsible for presenting GlobeID, Khetech, and Last-Minute PDF as immersive case-study reveals.
- **Content_Registry**: The single, typed source of truth for all identity, education, project, venture, and contact content. Implemented as one or more typed data modules (TypeScript) loadable at build time.
- **Interaction_System**: The set of pointer, keyboard, and touch behaviours, including hover depth, magnetic targets, focus management, scroll choreography, and tactile feedback.
- **Accessibility_Layer**: The cross-cutting concerns that enforce keyboard navigation, semantic structure, screen-reader compatibility, color contrast, and reduced-motion behaviour.
- **Responsive_Engine**: The rules that govern how the Visual_System, Motion_System, and Layout_Engine adapt across viewport sizes, input modalities, and device capabilities.
- **Build_System**: The toolchain (bundler, code-splitter, asset pipeline) responsible for producing the deployable artifact.
- **Cinematic_Background**: An optional ambient visual layer (e.g., shader, WebGL, GPU effect) that contributes atmosphere without competing with content.
- **Reduced_Motion_Mode**: The system state activated when the user agent reports `prefers-reduced-motion: reduce`, or when the user explicitly opts out of motion via an in-app control.
- **Performance_Budget**: The measurable runtime and asset thresholds the Portfolio_Site MUST meet (LCP, INP, CLS, FPS, bundle size, transfer size).
- **Identity_Profile**: The canonical record describing Devansh Barai (display name, positioning statement, two co-primary academic affiliations, contact channels) sourced from the canonical résumé.
- **Project_Record**: A typed record in the Content_Registry describing a single project with required fields including a stable id, display name, tagline, summary, role, year(s), tags, primary link, and optional artifacts.
- **Route_Map**: The mapping between human-readable section slugs (e.g., `#work`, `#about`) and DOM section identifiers used for in-page navigation and deep links.
- **Breakpoint_Tier**: A named, contiguous viewport-width range (e.g., `mobile`, `tablet`, `desktop`, `ultrawide`) that the Responsive_Engine resolves to for any given viewport width.
- **Above_The_Fold**: The portion of the first scene visible without scrolling on a 1440×900 desktop viewport and on a 390×844 mobile viewport.
- **Tactile_Interaction**: A pointer- or keyboard-triggered effect that produces a focused, time-bounded response to user intent (e.g., magnetic pull on a CTA, depth shift on hover, focus ring entry).

---

## Requirements

### Requirement 1: Identity and Content Preservation

**User Story:** As a visitor, I want the site to clearly and accurately present Devansh Barai's identity, education, and projects, so that I leave with a true and memorable understanding of who he is and what he has built.

#### Acceptance Criteria

1. WHEN the landing view (the first full-viewport section rendered at the top of the home route before any scroll input) becomes visible, THE Portfolio_Site SHALL display the owner's full name as the exact string "Devansh Barai" rendered as visible text in the page's largest heading element on that view.
2. WHEN the landing view becomes visible, THE Portfolio_Site SHALL display two co-primary academic credentials of equal standing as the exact strings "IIT Madras — BS in Data Science and Applications (2024–2028)" and "IIM Bangalore — BBA in Digital Business & Entrepreneurship (2025–2028)", rendered in typographic roles of equal visual weight (matching font size, weight, and surface treatment) and visually grouped together as a paired education credential block.
3. THE Portfolio_Site SHALL render no other academic credential in a typographic role visually equal to or larger than the two co-primary credentials defined in criterion 2.
4. THE Project_Showcase SHALL feature exactly four flagship Project_Records whose `name` fields equal the exact strings "GlobeID", "Khetech", "SupportDeskOps-v6", and "Last-Minute PDF", with no additional flagship entries rendered.
5. THE Content_Registry SHALL store each Project_Record with all of the following required fields populated and conforming to these bounds: `id` (string, 1 to 64 characters, lowercase alphanumeric and hyphens, unique across all records); `name` (string, 1 to 60 characters); `tagline` (string, 1 to 120 characters); `summary` (string, 1 to 600 characters); `role` (string, 1 to 80 characters); `year` (integer, 2000 to 2100 inclusive); `tags` (array of strings, 1 to 8 entries, each entry 1 to 24 characters); `primaryLink` (string conforming to criterion 8); `status` (string from the enumerated set defined in the Content_Registry, exactly one value).
6. WHERE a Project_Record has external collateral (live URL, repository, or case-study artifact), THE Project_Showcase SHALL render at least one user-activatable link whose visible label is a non-empty string of 1 to 40 characters that names the destination type (for example "Live", "Repository", or "Case Study") and is not equal to the raw URL string.
7. THE Portfolio_Site SHALL expose a contact channel consisting of (a) one email address that conforms to RFC 5322 syntax and matches the exact value "devanshbarai.official@gmail.com" sourced from the Content_Registry's verified-contacts entry and resolves to a single mailto link, and (b) at least two professional social links — one to "https://linkedin.com/in/devansh-barai" and one to "https://github.com/Devanshisbroke" — each resolving to an absolute `https://` URL listed in the Content_Registry's verified-contacts entry.
8. IF a Project_Record field references a URL, THEN THE Content_Registry SHALL validate at build time that the value parses as an absolute URL with scheme `https://` and a non-empty host, and SHALL fail the build with an error indicating the offending Project_Record `id` and field name while leaving previously generated build artifacts unmodified.
9. IF any required Project_Record field defined in criterion 5 is missing, empty, or violates its stated bounds, THEN THE Content_Registry SHALL fail the build with an error indicating the offending Project_Record `id` and the specific field that failed validation, and SHALL NOT publish any Project_Record from that build.
10. IF the contact channel defined in criterion 7 is missing the email address, contains an email that does not conform to RFC 5322 syntax, or contains fewer than two professional social links resolving to absolute `https://` URLs, THEN THE Portfolio_Site SHALL fail the build with an error indicating which contact target failed validation.

### Requirement 2: Creative Direction and Tone

**User Story:** As a visitor, I want the site to feel like a living identity system and cinematic editorial experience, so that I perceive a distinct, premium, intentional point of view rather than a templated portfolio.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL present a coherent creative direction expressible as one design statement of no more than 3 sentences, covering atmosphere, pacing, and tone, captured as a written deliverable produced during the design phase before implementation begins.
2. THE Visual_System SHALL NOT use any of the following audited baseline signatures on any route or viewport: full-page glassmorphism cards as the primary surface, animated cyan→indigo→pink hero gradient, aurora blob backgrounds, full-screen noise overlays, and the gradient-text treatment applied to every heading.
3. WHEN the Portfolio_Site loads on a 1440×900 desktop viewport or a 390×844 mobile viewport, THE Portfolio_Site SHALL display the owner's name and a single-line role/positioning statement within the Above_The_Fold region without requiring scroll.
4. THE Layout_Engine SHALL replace the section sequence "Hero → About → Education → Projects → Ventures → Skills → Contact" with a narrative ordering, chosen and justified during the design phase on grounds of emotional rhythm and discovery, that differs from the baseline in the opening section and in at least 2 adjacency pairs.
5. THE Portfolio_Site SHALL NOT include role typewriter cycles, percentage skill bars, or status badges on any route or viewport.
6. THE Portfolio_Site SHALL convey the owner's AI, product, and system-building orientation through at least one dedicated narrative moment that occupies its own scene or section, is rendered as prose or a single composed visual rather than a list of tags, and is at least 1 viewport tall on both the 1440×900 desktop and 390×844 mobile viewports.
7. IF any acceptance criterion in this requirement cannot be verified on a given route or viewport, THEN THE Portfolio_Site SHALL be treated as non-compliant for that route or viewport and the failure SHALL be recorded in the design-phase verification record.

### Requirement 3: Visual Identity

**User Story:** As a visitor, I want the site's visual identity to feel calm, intelligent, and premium, so that the atmosphere reinforces the content rather than competing with it.

#### Acceptance Criteria

1. THE Visual_System SHALL define a primary palette of no more than five core hues, a neutral ramp of at least nine named steps, and a surface ramp of at least five named steps, all exposed as named tokens with stable identifiers referenceable from component styles.
2. THE Visual_System SHALL define a base surface token, an elevated surface token, and at least one accent surface token, each exposed under a stable named identifier referenceable from component styles without redefinition.
3. THE Visual_System SHALL define spacing as a single scale with at least eight named steps, and THE Portfolio_Site SHALL reference only these spacing tokens for margin, padding, and gap values in component styles, with no spacing values defined outside the token scale.
4. THE Visual_System SHALL define radius tokens, shadow tokens, and border tokens with at least three named variants per category, and THE Portfolio_Site SHALL reference only these tokens in component styles, with no radius, shadow, or border values defined outside the token set.
5. THE Portfolio_Site SHALL render a default theme that is either dark, light, or both, as declared in the Visual_System theme configuration.
6. WHERE both dark and light themes are supported, WHEN the user selects a theme, THE Portfolio_Site SHALL persist that selection across browser sessions on the same device and apply the persisted selection on subsequent visits without requiring reselection.
7. WHERE a Cinematic_Background is rendered, THE Cinematic_Background SHALL remain non-interactive, SHALL render behind all foreground content in stacking order, and THE Visual_System SHALL ensure foreground text rendered over it meets WCAG 2.1 AA contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text).
8. WHERE a Cinematic_Background is removed or disabled, THE Portfolio_Site SHALL render all page sections with full content visibility and no overlapping, clipped, or collapsed regions caused by the removal.
9. THE Visual_System SHALL ensure that every text-on-surface token pair used by default content meets WCAG 2.1 AA contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text).

### Requirement 4: Typography System

**User Story:** As a visitor, I want type to feel editorial and refined, so that copy reads as considered writing rather than UI filler.

#### Acceptance Criteria

1. THE Typography_System SHALL define exactly one display family, one body family, and at most one supporting (monospace or accent) family.
2. THE Typography_System SHALL define a type scale with at least six named steps spanning display, headline, title, body, small, and caption, where each step has a defined font size within the range 10px to 96px.
3. THE Typography_System SHALL define line height, letter spacing, and weight tokens for each scale step.
4. WHEN a Portfolio_Site component renders text, THE Portfolio_Site SHALL set font-size, line-height, letter-spacing, and font-weight by referencing Typography_System tokens rather than literal numeric values.
5. THE Typography_System SHALL document the pairing of display and body families with a written rationale that explicitly addresses contrast, rhythm, and voice.
6. WHEN a heading has a computed font size greater than 48px, THE Typography_System SHALL apply letter spacing ≤ -0.02em and line height ≤ 1.1.
7. THE Typography_System SHALL exclude gradient fills from body copy and SHALL limit decorative type treatments (gradient fills, outlined or stroked glyphs, animated text effects, or display-family usage purely for emphasis on non-heading copy) to at most two occurrences per rendered page.
8. THE Portfolio_Site SHALL load all web fonts with `font-display: swap` or with an equivalent declaration that renders fallback text immediately and swaps to the web font once loaded, and SHALL preload the display family used Above_The_Fold.
9. IF a web font fails to load within 3 seconds, THEN THE Portfolio_Site SHALL render the affected text using a declared fallback family from the same font-family stack without blocking page render.

### Requirement 5: Motion System

**User Story:** As a visitor, I want motion to feel like a design language — smooth, tactile, intentional — so that movement guides attention without creating noise.

#### Acceptance Criteria

1. THE Motion_System SHALL define reusable named timing tokens consisting of at least one ease-out curve and one ease-in-out curve, and named duration tokens covering instant (≤ 80ms), short (120–220ms), medium (260–400ms), and long (500–900ms) ranges, and SHALL apply these tokens to all entrance, transition, and micro-interaction animations.
2. THE Motion_System SHALL drive all scroll-linked effects from exactly one shared scroll progress source and SHALL register zero additional `scroll` event listeners on `window` or `document` beyond that single source.
3. WHEN an element becomes at least 10% visible in the viewport as reported by an IntersectionObserver, THE Motion_System SHALL play its entrance animation exactly once per page session, where a page session is defined as the period from page load until the next full document reload.
4. WHILE a scroll-linked or pointer-linked effect is updating, THE Motion_System SHALL animate only `transform`, `opacity`, and `filter`, and SHALL NOT update layout-affecting properties including `width`, `height`, `top`, `left`, `margin`, or `padding` at scroll or pointer update frequency.
5. WHILE the user is actively scrolling, defined as the scroll position having changed within the previous 200ms, THE Motion_System SHALL maintain a sustained frame rate, measured as the 5th percentile over a rolling 1-second window, of at least 55 FPS on a 2020-or-newer desktop class device and at least 45 FPS on a mid-range mobile device representative of an iPhone 12 or equivalent.
6. WHEN a user hovers, focuses, or presses an interactive element (links, buttons, elements with role=button, and form controls), THE Motion_System SHALL begin the corresponding micro-interaction (hover depth, magnetic pull, focus entry, or press feedback) within 100ms of the input event.
7. IF Reduced_Motion_Mode is active, THEN THE Motion_System SHALL disable parallax, scroll-linked transforms, and decorative loops, and SHALL reduce all entrance and transition durations to ≤ 120ms or remove them entirely.
8. WHILE the user is idle, defined as no pointer, keyboard, scroll, or touch input for at least 3 seconds, THE Motion_System SHALL NOT auto-play any looping animation Above_The_Fold whose single loop cycle exceeds 6 seconds.

### Requirement 6: Layout Architecture and Narrative Pacing

**User Story:** As a visitor, I want the site to read as a paced journey with curiosity and discovery, so that I feel pulled forward rather than scrolling through stacked sections.

#### Acceptance Criteria

1. THE Layout_Engine SHALL define a sequence of between 4 and 7 named narrative scenes, where each scene is assigned exactly one narrative role from the enumerated set {opening, identity, work, philosophy, contact} and each role in the set appears at least once across the sequence.
2. THE Layout_Engine SHALL vary scene composition such that no two consecutive scenes share the same dominant layout pattern, where "dominant layout pattern" is exactly one value from the enumerated taxonomy {centered-hero, full-bleed-media, split-two-column, card-grid, vertical-list, asymmetric-editorial, immersive-canvas}.
3. WHILE the viewport width is at least 1024px, THE Layout_Engine SHALL render at least one negative-space transition between any two adjacent dense scenes, where "dense scene" is defined as a scene with a rendered vertical extent greater than 100vh OR containing 5 or more discrete content blocks, and the negative-space transition SHALL occupy a vertical extent of at least 40vh and at most 80vh.
4. WHEN first contentful paint occurs on the opening scene, THE Layout_Engine SHALL render the owner's identity name and primary credential as visible text nodes in the DOM within 5 seconds of first contentful paint, and these nodes SHALL remain present and visible irrespective of subsequent user input, idle state, scroll position, or animation completion state.
5. WHEN the user has scrolled through the first 1.5 viewport heights from the top of the document, THE Layout_Engine SHALL have rendered at least one transition event whose dominant layout pattern (as defined in criterion 2) differs from that of the opening scene and whose narrative role differs from "opening".
6. THE Layout_Engine SHALL assign each scene a unique URL-safe anchor identifier (matching the character set [a-z0-9-], length between 1 and 64 characters) exposed in the Route_Map, and WHEN a deep link referencing a valid anchor identifier is requested, THE Layout_Engine SHALL scroll the corresponding scene into the viewport within 2 seconds of navigation completion.
7. IF a deep link references an anchor identifier that is not present in the Route_Map, THEN THE Layout_Engine SHALL render the opening scene as the default landing target and SHALL surface a user-visible indication that the requested scene was not found, without unloading or replacing the existing document.
8. WHILE the viewport width is at least 1024px, THE Layout_Engine SHALL constrain body prose to a maximum content measure of 75 characters per line.

### Requirement 7: Interaction Philosophy

**User Story:** As a visitor, I want interactions to feel tactile and intentional, so that exploration is rewarded and the experience feels alive.

#### Acceptance Criteria

1. THE Interaction_System SHALL render a hover or focus response on every actionable element that differs from its rest state by at least one of the following enumerated visual properties (color, elevation/shadow, scale up to 1.05x, opacity, blur), and SHALL ensure the change between rest and hover/focus states meets a minimum 3:1 contrast ratio for non-text visual indicators per WCAG 2.1 SC 1.4.11.
2. WHEN the cursor enters the hit-area of a primary call-to-action, THE Interaction_System SHALL apply a magnetic or weighted hover treatment bounded so that the rendered cursor position remains within the actionable hit-area at all times, and SHALL release the cursor to its true position within 100ms of the cursor exiting the hit-area.
3. WHEN a Tactile_Interaction is triggered, THE Interaction_System SHALL produce an observable visual response (change in color, position, scale, or opacity) within 100ms of the trigger and SHALL fully complete the response within 400ms of the trigger.
4. THE Interaction_System SHALL NOT replace the native operating-system cursor globally.
5. WHERE a custom cursor enhancement is enabled, THE Interaction_System SHALL render the enhancement as an additive overlay on top of the native cursor, SHALL preserve a zero-pixel offset between the native cursor hot-spot and each target's activation point, and SHALL preserve full keyboard operability and assistive-technology announcement of the underlying actionable element.
6. WHILE a pointer device is unavailable (touch-only or keyboard-only navigation), THE Interaction_System SHALL provide focus and press-state feedback that satisfies WCAG 2.1 SC 2.4.7 (focus visible) and SC 1.4.11 (3:1 non-text contrast against the adjacent background).
7. THE Interaction_System SHALL expose at least three discoverable but non-essential micro-moments (such as easter eggs, environmental responses, or hover reveals) that draw user attention for no longer than 2 seconds per occurrence, are dismissible by pressing Escape, moving the pointer out of the trigger zone, or tapping outside the trigger zone on touch devices, and SHALL NOT block, delay, or prevent completion of any primary task including reading content, opening a project link, or contacting the owner.
8. WHILE the user agent reports prefers-reduced-motion as active, THE Interaction_System SHALL degrade hover, focus, tactile, and micro-moment responses to instant state changes that still produce a visible change within 100ms and reach final state within 400ms, and SHALL suppress all animated transitions, magnetic cursor pull, and motion-based micro-moments.

### Requirement 8: Project Showcase Strategy

**User Story:** As a visitor evaluating Devansh's work, I want each project to feel like a product reveal, so that I understand the conviction, decisions, and impact behind each one.

#### Acceptance Criteria

1. THE Project_Showcase SHALL present GlobeID, Khetech, SupportDeskOps-v6, and Last-Minute PDF such that each project's reveal differs from every other on all three of the following dimensions concurrently: visual treatment (background palette or imagery), layout structure (composition or grid arrangement), and motion sequence (entrance choreography), and SHALL NOT render the four projects within a single uniform card grid.
2. WHEN a project enters its dedicated reveal scene, THE Project_Showcase SHALL animate at least three concurrent layers consisting of typography, motion, and a visual artifact, and SHALL complete the full reveal sequence within 3000 milliseconds from scene entry.
3. THE Project_Showcase SHALL surface, for each project, all of the following data points: a tagline of 1 to 140 characters, a problem framing of 1 to 600 characters, the owner's role, at least one outcome or differentiator, a technology orientation label, and exactly one primary link.
4. WHERE a project supports an expandable case study and the viewport width is at least 1024 pixels, THE Project_Showcase SHALL allow the user to expand or navigate into deeper detail in-place without performing a full-page navigation away from the showcase narrative.
5. THE Project_Showcase SHALL present projects in the ordering specified by the Content_Registry.
6. THE Project_Showcase SHALL render the project ordering deterministically such that the sequence is identical across repeated renders for the same Content_Registry state.
7. THE Project_Showcase SHALL NOT present skill percentage bars, generic "live" pill badges replicated from the audited baseline, or stock screenshots without contextual framing.
8. THE Project_Showcase SHALL preemptively render every external project link with `target="_blank"` and `rel="noopener noreferrer"` set in the DOM regardless of whether the link has been interacted with, so that all activation methods (left click, middle click, modifier-click, keyboard activation, assistive-technology activation) open the destination in a new browsing context with the security attributes applied.
9. IF any of the required data points listed in criterion 3 are absent from the Content_Registry entry for a project, THEN THE Project_Showcase SHALL omit the project from the rendered showcase and SHALL surface a non-blocking indication that the entry was skipped due to incomplete data, while continuing to render the remaining projects in their specified order.
10. WHILE the user's system reports a reduced-motion preference, THE Project_Showcase SHALL render each project's reveal as a static composition that preserves the typography and visual artifact layers from criterion 2 and SHALL suppress motion-driven animation for the reveal sequence.

### Requirement 9: Content Voice and Rewrite

**User Story:** As a visitor, I want copy to read as human, considered writing, so that the owner's intelligence and intent come through in the language itself.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL present rewritten copy across identity, project, education, and contact narratives such that no rendered prose string is verbatim-identical (case-insensitive, whitespace-normalized) to any string in the Content_Registry pre-rewrite captured baseline set.
2. THE Portfolio_Site SHALL render no prose containing any entry from the Content_Registry banned-phrase list (case-insensitive substring match), which SHALL include at minimum the four examples "passionate about", "leveraging cutting-edge", "results-driven", and "in today's fast-paced world".
3. THE Portfolio_Site SHALL render each section opener, defined as the first prose paragraph of each top-level section, with an average sentence length under 20 words, where average sentence length is computed as total word count divided by sentence count and a sentence is delimited by a period, question mark, or exclamation mark.
4. WHERE a top-level section contains no prose paragraph or where average sentence length cannot be computed because the sentence count is zero, THE Portfolio_Site SHALL treat the sentence-length target as satisfied and SHALL NOT block publishing.
5. THE Portfolio_Site SHALL describe each project with at least one first-person sentence and at least one additional sentence stating an underlying conviction or insight that is distinct from any feature enumeration sentence in the same project description.
6. THE Portfolio_Site SHALL communicate the owner's AI, product, and system-building orientation through at least one copy beat, defined as a continuous block of one or more full sentences of prose, that is not rendered as a tag, chip, badge, or keyword list.
7. IF a piece of rendered copy makes a quantitative claim about users, growth, accuracy, or scale, THEN THE Content_Registry SHALL store the claim as a structured record containing the claim value and a non-empty verifiable source field.
8. IF a quantitative claim has no non-empty verifiable source field in the Content_Registry, THEN THE Portfolio_Site SHALL omit the claim entirely from the rendered output and SHALL NOT display the claim value in any form.

### Requirement 10: Technical Architecture

**User Story:** As the maintainer, I want a production-grade architecture, so that the site is fast to iterate, easy to extend, and stable in production.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL be built with React 18 or higher as the UI runtime, on a Vite or Next.js toolchain, using the same package manager (pnpm), TypeScript configuration, and module resolution settings already established in the workspace.
2. THE Portfolio_Site SHALL use Tailwind CSS or an equivalent token-driven styling system, with all design tokens for color, typography, spacing, and motion sourced from a single configuration module such that changing a token value in that module is the only edit required to propagate the change across every component that consumes the token.
3. WHERE the Motion_System orchestrates more than a single property transition on a single element, or coordinates two or more elements across a sequence, THE Motion_System SHALL use Framer Motion as the primary library, and SHALL only introduce GSAP for scroll-linked timelines or multi-stage timelines that cannot be expressed using Framer Motion's declarative animation, variants, or layout APIs.
4. WHERE GPU-driven atmosphere is used, THE Cinematic_Background SHALL be implemented via WebGL, WebGPU, or CSS GPU primitives, isolated behind a single React component boundary that exposes no GPU APIs, contexts, or shader source to the rest of the application, and SHALL be lazy-loaded after First Contentful Paint such that the initial HTML and critical CSS render without awaiting the Cinematic_Background module's download, parse, or initialization.
5. THE Portfolio_Site SHALL split code by route, by below-the-fold scene, and by heavy optional modules including the Cinematic_Background and project deep-dives, so that the initial JavaScript payload Above_The_Fold remains within the Performance_Budget defined in Requirement 11.
6. IF a production build's measured initial JavaScript payload Above_The_Fold exceeds the Performance_Budget threshold defined in Requirement 11.7, THEN THE Build_System SHALL fail the build with a non-zero exit status and SHALL surface, in the build output, the measured payload size and the budget threshold that was exceeded.
7. THE Portfolio_Site SHALL load images and media that render outside the initial viewport (i.e., not Above_The_Fold) using native lazy loading or an equivalent intersection-based mechanism, while images and media that render inside the initial viewport SHALL load eagerly.
8. THE Content_Registry SHALL be expressed as typed TypeScript data such that identity content, project entries, case studies, and any other content rendered by the primary routes is resolvable at build time with no runtime network fetch required to display that content.
9. THE Build_System SHALL produce a deployable artifact via the existing pnpm with Vite (or Next.js) workflow that requires no backend service to render any user-visible feature.
10. THE deployable artifact SHALL function fully when served as static files with no runtime API, database, analytics endpoint, or other server-side dependency, such that every primary route renders its complete content from the static artifact alone.
11. THE Portfolio_Site SHALL render HTML that parses without errors against the HTML Living Standard, and the initial server-rendered or pre-rendered response SHALL contain the maintainer's name, role headline, and the title and short summary of each listed project as text in the document body so that crawlers and link-preview consumers can extract this content without executing JavaScript.

### Requirement 11: Performance Budgets

**User Story:** As a visitor on any reasonable device and connection, I want the site to feel instantaneous and smooth, so that performance reinforces the premium impression.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL achieve Largest Contentful Paint (LCP) of ≤ 2.0 seconds on a simulated Fast 4G connection at desktop and ≤ 2.5 seconds at mobile, measured as the median of three sequential Lighthouse runs against the deployed production build with a cold browser cache for each run.
2. THE Portfolio_Site SHALL maintain a session Cumulative Layout Shift (CLS) ≤ 0.05 measured across a first-load session that scrolls from the opening scene through every named narrative scene defined per Requirement 6.1 to the final scene, on the deployed production build.
3. THE Portfolio_Site SHALL maintain Interaction to Next Paint (INP) ≤ 200ms at the 75th percentile of all recorded interactions, measured across a synthetic test session that exercises every interactive element across all named narrative scenes defined per Requirement 6.1 at least three times each on the deployed production build.
4. THE Portfolio_Site SHALL achieve First Contentful Paint (FCP) ≤ 1.5 seconds on a simulated Fast 4G mobile connection, measured as the median of three sequential Lighthouse runs against the deployed production build with a cold browser cache for each run.
5. WHILE the user is scrolling continuously through any named narrative scene defined per Requirement 6.1 on a 2020-or-newer desktop class device, THE Portfolio_Site SHALL sustain ≥ 55 frames per second measured as the 5th percentile of per-frame rates across a continuous scroll sample of at least 5 seconds.
6. WHILE the user is scrolling continuously through any named narrative scene defined per Requirement 6.1 on a mid-range mobile device representative of an iPhone 12 or equivalent, THE Portfolio_Site SHALL sustain ≥ 45 frames per second measured as the 5th percentile of per-frame rates across a continuous scroll sample of at least 5 seconds.
7. THE Portfolio_Site SHALL ship an initial JavaScript payload (Above_The_Fold critical path) of at most 180 KB gzipped, where exactly 180 KB is permitted and 180 KB + 1 byte is not, measured as the sum of all JavaScript transfer sizes required to render the Above_The_Fold region of the deployed production build with a cold browser cache.
8. THE Portfolio_Site SHALL ship a total transferred payload Above_The_Fold (HTML + CSS + JS + critical images) of at most 350 KB gzipped on first load, where exactly 350 KB is permitted and 350 KB + 1 byte is not, measured as the sum of all transfer sizes required to render the Above_The_Fold region of the deployed production build with a cold browser cache.
9. THE Portfolio_Site SHALL achieve a Lighthouse Performance score ≥ 90 on the mobile profile and ≥ 95 on the desktop profile, measured as the median of three sequential Lighthouse runs against the deployed production build with a cold browser cache for each run.
10. IF a motion or visual effect causes a measured frame rate drop below the threshold defined in criterion 5 on the desktop reference device, or below the threshold defined in criterion 6 on the mobile reference device, under the sample window defined in those criteria, THEN THE Motion_System SHALL be modified to remove or downgrade that effect prior to release.

### Requirement 12: Responsive Strategy and Graceful Degradation

**User Story:** As a visitor on phone, tablet, desktop, or ultrawide, I want the experience to feel native to my device, so that the cinematic intent survives every screen.

#### Acceptance Criteria

1. THE Responsive_Engine SHALL define exactly four named Breakpoint_Tiers with contiguous, non-overlapping viewport-width ranges covering all widths from 320px upward: `mobile` (320px to 767px inclusive), `tablet` (768px to 1023px inclusive), `desktop` (1024px to 1919px inclusive), and `ultrawide` (1920px and above).
2. WHEN a viewport width of 320px or greater is provided as input, THE Responsive_Engine SHALL resolve it to exactly one Breakpoint_Tier from {`mobile`, `tablet`, `desktop`, `ultrawide`}.
3. THE Layout_Engine SHALL render every primary scene without horizontal overflow at viewport widths from 320px to 3840px inclusive.
4. WHEN the viewport width is below 768px (the `tablet` lower bound), THE Layout_Engine SHALL adapt multi-column scene compositions to single-column equivalents such that (a) all content present in the multi-column composition is rendered and reachable via vertical scroll, (b) reading order proceeds top-to-bottom and left-to-right, and (c) no content is hidden or truncated.
5. WHEN the device reports a coarse pointer (touch-primary) or no hover capability, THE Interaction_System SHALL replace hover-only affordances with tap or focus equivalents.
6. WHEN the device reports `prefers-reduced-data: reduce` or a Save-Data hint, THE Portfolio_Site SHALL skip the Cinematic_Background and decorative media beyond the primary scene.
7. WHEN the device reports either a `navigator.hardwareConcurrency` value of ≤ 4 logical cores OR (where exposed) a `navigator.deviceMemory` value of ≤ 4 GB, with the disjunction triggered by either condition holding, THE Portfolio_Site SHALL automatically disable the Cinematic_Background or substitute a static visual fallback.
8. THE Portfolio_Site SHALL ensure every interactive target on touch devices has a minimum hit area of 44×44 CSS pixels.
9. WHEN the user agent does not support a feature required by the Cinematic_Background (e.g., WebGL), THE Portfolio_Site SHALL render a static visual fallback such that (a) no horizontal overflow occurs at viewport widths from 320px to 3840px inclusive, (b) all interactive targets remain rendered and operable, and (c) reading order is preserved.

### Requirement 13: Accessibility

**User Story:** As a visitor using assistive technology, a keyboard, or with reduced-motion preferences, I want full access to the site, so that the cinematic intent does not exclude me.

#### Acceptance Criteria

1. WHEN the user agent reports `prefers-reduced-motion: reduce` on initial page load, THE Portfolio_Site SHALL activate Reduced_Motion_Mode before any animation begins.
2. THE Accessibility_Layer SHALL expose an in-app control to toggle Reduced_Motion_Mode independent of the OS preference, and the control SHALL be persistently discoverable on every page, reachable and operable via standard keyboard keys (Tab to focus, Enter or Space to activate).
3. WHEN the user changes the Reduced_Motion_Mode toggle, THE Accessibility_Layer SHALL persist the chosen value across browser sessions on the same device until the user changes it again.
4. WHILE Reduced_Motion_Mode is active, THE Portfolio_Site SHALL satisfy all motion-related criteria of Requirement 5.7.
5. THE Portfolio_Site SHALL be fully operable via keyboard alone, ensuring every interactive element is reachable via Tab/Shift+Tab in a logical focus order matching visual order, activatable via standard keys (Enter/Space for buttons and links, Escape to dismiss overlays), and free of keyboard traps (focus can always move away from any element using standard navigation keys).
6. THE Portfolio_Site SHALL display a visible focus indicator on every focusable element that simultaneously satisfies both WCAG 2.1 AA non-text contrast (≥ 3:1) AND a minimum indicator thickness of 2 CSS pixels — failing either condition is a violation.
7. THE Portfolio_Site SHALL provide a "skip to content" link as the first focusable element on every page, which SHALL be visually hidden until focused, become visible on focus, and on activation move keyboard focus to the start of the `main` landmark, bypassing repeated navigation landmarks.
8. THE Portfolio_Site SHALL use semantic HTML landmarks (`header`, `nav`, `main`, `section` with accessible names, `footer`) and SHALL ensure heading levels follow a single valid hierarchy per page that starts at h1, contains exactly one h1, and skips no levels (e.g., h2 must not be followed by h4).
9. THE Portfolio_Site SHALL provide every actionable element, including icon-only buttons and links, with a non-empty accessible name conveying its purpose to assistive technology.
10. THE Portfolio_Site SHALL provide every meaningful image with a non-empty `alt` attribute conveying its purpose, and SHALL mark every decorative image with `alt=""` or an equivalent ARIA mechanism that removes it from the accessibility tree.
11. THE Portfolio_Site SHALL maintain WCAG 2.1 AA color contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text and meaningful non-text UI affordances including focus indicators) across all interactive states (default, hover, focus, active, disabled).
12. IF an interactive element relies on motion or color alone to convey state, THEN THE Accessibility_Layer SHALL provide a redundant cue using a non-color, non-motion channel (text label, iconography, shape, or pattern).
13. THE Portfolio_Site SHALL set a valid BCP 47 language tag on the root element's `lang` attribute and SHALL provide page metadata (title, description, Open Graph, Twitter Card) reflecting the current page's visible content.

### Requirement 14: Route Map and Navigation Integrity

**User Story:** As a visitor following a deep link or navigating across scenes, I want every link to resolve cleanly, so that the journey is never broken.

#### Acceptance Criteria

1. THE Route_Map SHALL define a bijection between navigation slug entries and DOM section identifiers such that the count of slug entries equals the count of navigable section identifiers, every slug resolves to exactly one section, and every navigable section is reachable from exactly one slug.
2. WHEN the user activates an in-page navigation link and Reduced_Motion_Mode is inactive, THE Layout_Engine SHALL scroll to the linked section using a smooth-scroll behaviour that completes within 800ms.
3. WHILE Reduced_Motion_Mode is active, WHEN the user activates an in-page navigation link, THE Layout_Engine SHALL position the linked section at the top of the viewport within 50ms with no animated interpolation.
4. WHEN the page loads with a hash fragment matching a known slug in the Route_Map, THE Layout_Engine SHALL position the corresponding section so that its top edge aligns with the bottom of any sticky header within a tolerance of ±2 pixels.
5. IF the page loads with a hash fragment that does not match any known slug in the Route_Map, THEN THE Layout_Engine SHALL position the document at the opening scene, defined as the first slug entry in the Route_Map, without raising a runtime error and without surfacing any error indication to the user.
6. WHEN the user scrolls and a scene occupies the largest visible viewport area while covering at least 50% of the viewport height, THE Portfolio_Site SHALL update the URL hash to the slug of that scene, debounced to no more than four updates per second.
7. WHERE a link's resolved target host differs from the current document's origin, THE Portfolio_Site SHALL open that link in a new browsing context with `rel="noopener noreferrer"`.

### Requirement 15: Content Registry Integrity (Property-Based Testable)

**User Story:** As the maintainer, I want the Content_Registry to be machine-checkable, so that broken or partial content cannot reach production.

#### Acceptance Criteria

1. FOR ALL Project_Records in the Content_Registry, THE Content_Registry SHALL guarantee that the required fields `id`, `name`, `tagline`, `summary`, `role`, `year`, `tags`, `primaryLink`, `status` are present and non-empty, where "non-empty" is defined uniformly as a string of length ≥ 1 after trimming leading and trailing whitespace, or for arrays a length ≥ 1, with maximum lengths of `id` ≤ 64 characters, `name` ≤ 120 characters, `tagline` ≤ 200 characters, `summary` ≤ 2000 characters, `role` ≤ 120 characters, and `status` ≤ 32 characters.
2. FOR ALL Project_Records, THE Content_Registry SHALL guarantee that `id` is unique across the registry, where "unique" is defined as exact case-sensitive string equality such that no two records share an identical `id` value.
3. FOR ALL Project_Records, THE Content_Registry SHALL guarantee that `primaryLink` parses as an absolute URL of length ≤ 2048 characters whose scheme is exactly `https` (lowercase) and whose host component is non-empty after trimming.
4. FOR ALL Project_Records, THE Content_Registry SHALL guarantee that `year` parses either as a single four-digit year Y where 2000 ≤ Y ≤ (current calendar year + 1), or as a year range with endpoints Y1 and Y2 where 2000 ≤ Y1 ≤ Y2 ≤ (current calendar year + 1) inclusive.
5. FOR ALL Project_Records, THE Content_Registry SHALL guarantee that `tags` is an array containing between 1 and 20 entries inclusive, where each entry is a non-empty string of length ≥ 1 and ≤ 40 characters after trimming, and all entries are unique under exact case-sensitive string equality.
6. FOR ALL Project_Records, THE Content_Registry SHALL guarantee that the round-trip property holds such that serializing a record to JSON and parsing it back produces a structurally equivalent record, where "structurally equivalent" is defined as deep equality with an identical field set, identical scalar values, identical array element order, and identical nested key sets with no additions, removals, or reorderings.
7. THE Content_Registry SHALL guarantee that the Identity_Profile contains the canonical fields `displayName`, `currentInstitution`, `currentProgram`, `currentYears`, `crossReferences`, `email`, and `socials`, all non-empty under the uniform definition in criterion 1, with each string identity field of length ≤ 200 characters after trimming, `email` of length ≤ 254 characters parsing as a valid RFC 5322-style address, `crossReferences` and `socials` each containing between 1 and 20 entries inclusive, and each `socials[].url` parsing as an absolute URL of length ≤ 2048 characters whose scheme is exactly `https` (lowercase) and whose host component is non-empty.
8. THE Content_Registry SHALL be the single source of truth such that every user-visible primary content string for project and identity content rendered in the Portfolio_Site originates from a typed Content_Registry module and no such string appears as a literal in any rendering module outside the Content_Registry's typed modules.
9. IF any guarantee defined in criteria 1 through 8 is violated for any record or field, THEN THE Content_Registry integrity check SHALL terminate non-successfully with an error indicating the violating record identifier, the violating field name, and the violated guarantee, and THE build SHALL be prevented from producing a deployable artifact.

### Requirement 16: Route Map Bijection (Property-Based Testable)

**User Story:** As the maintainer, I want navigation correctness expressible as a property, so that adding or renaming sections cannot silently break links.

#### Acceptance Criteria

1. FOR ALL slugs in the Route_Map, THE Layout_Engine SHALL guarantee that within 2000 milliseconds after initial mount completion, a corresponding rendered section exists whose DOM identifier matches the slug's target via case-sensitive string equality and is retrievable via a non-null DOM lookup.
2. FOR ALL rendered sections that participate in navigation, defined as sections having a non-empty DOM identifier and rendered as a descendant of the main content region, THE Route_Map SHALL contain exactly one slug entry whose target equals the section's DOM identifier under case-sensitive string comparison.
3. FOR ALL slug-section pairs `(s, id)` in the Route_Map, the round-trip property SHALL hold such that looking up the slug by section id and looking up the section id by slug return values that satisfy bidirectional equality with the original pair, with both lookup functions being deterministic across repeated invocations and completing in constant time relative to Route_Map size.
4. THE Route_Map SHALL guarantee that no two distinct slugs target the same DOM identifier and no DOM identifier is reachable from two distinct slugs, enforced via case-sensitive string comparison across all entries.
5. IF any property defined in criteria 1 through 4 is violated, THEN THE Layout_Engine SHALL produce a deterministic failure indication that identifies the violating slug or DOM identifier and the specific property violated, without rolling back the Route_Map state.
6. WHEN the Route_Map is constructed or modified, THE Layout_Engine SHALL validate that the Route_Map contains between 1 and 1000 entries inclusive and that all properties in criteria 1 through 4 hold, rejecting the construction or modification with a failure indication if any check fails.

### Requirement 17: Responsive Breakpoint Contract (Property-Based Testable)

**User Story:** As the maintainer, I want breakpoint resolution to be a total, deterministic function, so that no viewport width can fall through the cracks.

#### Acceptance Criteria

1. FOR ALL integer viewport widths `w` in the closed range [320, 3840], THE Responsive_Engine SHALL resolve `w` to exactly one Breakpoint_Tier, and SHALL return the same Breakpoint_Tier on every invocation with the same `w`, ensuring totality and determinism across the supported range.
2. FOR ALL adjacent integer widths `(w, w+1)` in the closed range [320, 3840], THE Responsive_Engine SHALL ensure that the resolved tier rank, defined as an integer index from 1 to 4 corresponding to the documented Breakpoint_Tier ordering from narrowest to widest, is non-decreasing as `w` increases and differs by at most 1 between `w` and `w+1`, expressing monotonic transitions.
3. THE Responsive_Engine SHALL partition the closed range [320, 3840] across the four documented Breakpoint_Tiers such that (a) every integer width in [320, 3840] resolves to exactly one Breakpoint_Tier, (b) any two distinct Breakpoint_Tiers share no integer width within [320, 3840], and (c) the union of integer widths assigned across all four Breakpoint_Tiers equals the full closed range [320, 3840] with no gaps.
4. FOR ALL pairs of integer widths `(w1, w2)` in the closed range [320, 3840] that resolve to the same Breakpoint_Tier, THE Responsive_Engine SHALL produce layout-tier outputs that are equal under deep value comparison of every public output field of the layout tier, demonstrating idempotence within a tier.

### Requirement 18: Reduced Motion Behaviour (Property-Based Testable)

**User Story:** As the maintainer, I want reduced-motion behaviour to be checkable as a property, so that any future motion variant is automatically governed.

#### Acceptance Criteria

1. FOR ALL motion variants registered with the Motion_System, WHILE Reduced_Motion_Mode is active, THE Motion_System SHALL produce a resolved variant whose total duration, defined as the sum of all keyframe durations and inter-keyframe delays measured in milliseconds, is either exactly 0ms or less than or equal to 120ms.
2. FOR ALL motion variants registered with the Motion_System, WHILE Reduced_Motion_Mode is active, THE Motion_System SHALL produce a resolved variant whose transform component is exactly one of the identity transition, an opacity-only transition, or a color-only transition, and SHALL contain no parallax, no scale greater than 1.05, no rotation, and no scroll-linked translate.
3. THE Motion_System SHALL guarantee idempotence such that applying the reduced-motion transformation twice to any variant produces a variant that is structurally identical to applying it once, where structural identity requires equal total duration in milliseconds, equal transform component, equal easing function, and equal keyframe ordering.
4. WHEN Reduced_Motion_Mode completes a full toggle cycle in either direction (off-then-on or on-then-off), THE Motion_System SHALL return the resolved variant to a state structurally identical to its original state, using the same structural identity definition of equal total duration in milliseconds, equal transform component, equal easing function, and equal keyframe ordering.
5. IF a registered motion variant cannot be transformed to satisfy the bounds defined in criteria 1 and 2, THEN THE Motion_System SHALL substitute an identity no-op variant with total duration 0ms and SHALL surface a failure indication identifying the offending variant.

### Requirement 19: Dependency Hygiene and Build Quality

**User Story:** As the maintainer, I want the project to build cleanly and reproducibly, so that future iteration is low-friction.

#### Acceptance Criteria

1. WHEN `pnpm run typecheck` is executed from the workspace root, THE Build_System SHALL terminate with exit code 0 and report zero TypeScript errors.
2. WHEN `pnpm --filter @workspace/portfolio run build` is executed from the workspace root, THE Build_System SHALL terminate with exit code 0 and emit zero compiler or bundler warnings other than warnings explicitly suppressed via configuration documented in the repository.
3. WHEN a single workspace-level pnpm test script is executed from the workspace root, THE Portfolio_Site SHALL run automated tests covering the property-based correctness defined in Requirements 15, 16, 17, and 18 and SHALL terminate with exit code 0 with zero failing tests for the run to be considered passing.
4. THE Portfolio_Site SHALL declare every runtime and build-time dependency required by its build, typecheck, and test commands in a `package.json` within the workspace such that `pnpm install` executed from the workspace root is sufficient to install all required tooling.
5. THE Portfolio_Site SHALL NOT require any globally installed tooling to execute its build, typecheck, or test commands, with the sole exceptions of the Node.js runtime and the pnpm package manager.
6. WHEN `pnpm install` is executed from the workspace root at build time, THE Build_System SHALL surface every deprecation warning reported by pnpm for packages in the production runtime dependency tree on standard output, and IF any such deprecation warning is reported for a production runtime dependency, THEN THE Build_System SHALL terminate with a non-zero exit code indicating dependency hygiene failure.
