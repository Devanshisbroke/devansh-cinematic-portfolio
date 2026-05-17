import { lazy, Suspense, type ReactNode } from 'react';
import type { Project_Record } from '../../content-registry/types';

/**
 * Lazy reveal renderers — one chunk per project.
 *
 * Each module under `./reveals/*` is the sole owner of its project's
 * choreography: it registers its `MotionVariant`s through
 * `motion/motion-create.registerVariant`, reads the live
 * `Reduced_Motion_Mode` flag, and renders the **final composed state**
 * statically when the flag is on — all variants in that branch are
 * funnelled through `applyReducedMotion` (R8.10, design.md
 * § "Reduced-motion variant"). This dispatcher therefore does not
 * inspect the preference itself: the per-reveal renderer is closer to
 * the markup it needs to swap.
 *
 * The four renderers are split into separate lazy chunks so the Work
 * scene only pays for the project that's currently being revealed —
 * the three sibling reveals stay out of the initial Work-scene chunk
 * (R11.8 / design.md § "Lazy boundaries").
 */
// @vite-ignore — these modules land in tasks 11.5–11.8; this file
// intentionally compiles ahead of them so the dispatcher exists at
// the boundary expected by `TheWork.tsx` (task 11.9).
const GlobeIDReveal = lazy(() =>
  import('./reveals/GlobeIDReveal').then((m) => ({ default: m.GlobeIDReveal })),
);
const KhetechReveal = lazy(() =>
  import('./reveals/KhetechReveal').then((m) => ({ default: m.KhetechReveal })),
);
const SupportDeskOpsReveal = lazy(() =>
  import('./reveals/SupportDeskOpsReveal').then((m) => ({
    default: m.SupportDeskOpsReveal,
  })),
);
const LastMinutePDFReveal = lazy(() =>
  import('./reveals/LastMinutePDFReveal').then((m) => ({
    default: m.LastMinutePDFReveal,
  })),
);

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface ProjectRevealProps {
  readonly project: Project_Record;
}

/**
 * Dispatches a `Project_Record` to its matching reveal renderer.
 *
 * Each reveal is lazy-loaded so the four reveal modules end up in
 * distinct chunks (the Work scene only pays for the project that's
 * currently being revealed). Under `Reduced_Motion_Mode`, each reveal
 * renderer is responsible for rendering its own static
 * final-state composition with all `MotionVariant`s passed through
 * `applyReducedMotion` (R8.10); this dispatcher does not branch on
 * the preference itself.
 *
 * Returns `null` for an unknown `project.id` rather than throwing —
 * the registry validator (task 4.x) is the single source of truth for
 * "which projects exist", and the renderer must keep going for the
 * remaining entries (R8.9). Any drift between the registry and the
 * dispatcher's switch is caught at build time by Property 9 / the
 * scene smoke tests, not at runtime.
 *
 * Validates: Requirements 8.10
 */
export function ProjectReveal({ project }: ProjectRevealProps): ReactNode {
  const Renderer = pickRenderer(project.id);
  if (Renderer === null) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div
          data-reveal-fallback
          id={`scene-work-${project.id}`}
          aria-hidden="true"
          style={{ minHeight: '60vh' }}
        />
      }
    >
      <Renderer project={project} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Internal: id → renderer dispatch
// ---------------------------------------------------------------------------

/**
 * Resolve a `Project_Record.id` to the matching lazy reveal component,
 * or `null` if no renderer is registered for that id. The four
 * accepted ids match `Project_Record.id` slugs in
 * `content-registry/data.ts`: `'globeid'`, `'khetech'`,
 * `'supportdeskops-v6'`, `'last-minute-pdf'`.
 */
function pickRenderer(
  projectId: string,
): React.LazyExoticComponent<(props: { project: Project_Record }) => ReactNode> | null {
  switch (projectId) {
    case 'globeid':
      return GlobeIDReveal as never;
    case 'khetech':
      return KhetechReveal as never;
    case 'supportdeskops-v6':
      return SupportDeskOpsReveal as never;
    case 'last-minute-pdf':
      return LastMinutePDFReveal as never;
    default:
      return null;
  }
}
