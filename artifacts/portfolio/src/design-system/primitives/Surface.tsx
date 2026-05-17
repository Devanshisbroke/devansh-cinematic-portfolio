/**
 * Surface — token-driven background primitive.
 *
 * `tone` accepts the redesign's surface vocabulary (`base | raised | sunken |
 * accent | inverse`) and resolves to a `--surface-*` CSS custom property
 * published by `styles/theme.css`. The component never accepts literal color
 * values, never sets a width/height, and never mixes raw spacing — layout is
 * the caller's job (typically a `<Stack>` or `<Inline>` parent).
 *
 * The mapping below intentionally translates the design's surface labels to
 * the canonical `SurfaceTone` identifiers in `tokens.types.ts`:
 *
 *   base    → --surface-base
 *   raised  → --surface-elevated-1
 *   sunken  → --surface-elevated-2
 *   accent  → --surface-accent
 *   inverse → --surface-overlay   (used as the inverted scrim tone)
 *
 * Validates: Requirements 3.3, 4.1
 */

import {
  forwardRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';

/**
 * Public tone vocabulary used by callers. Distinct from the internal
 * `SurfaceTone` token identifier so consumers speak the design's redesign
 * language; the mapping below is the single boundary between the two.
 */
export type SurfacePrimitiveTone =
  | 'base'
  | 'raised'
  | 'sunken'
  | 'accent'
  | 'inverse';

/** Mapping from the public tone vocabulary to the published CSS custom property. */
const TONE_TO_VAR: Readonly<Record<SurfacePrimitiveTone, string>> = {
  base: 'var(--surface-base)',
  raised: 'var(--surface-elevated-1)',
  sunken: 'var(--surface-elevated-2)',
  accent: 'var(--surface-accent)',
  inverse: 'var(--surface-overlay)',
};

export interface SurfaceProps {
  /** Surface tone token. Defaults to `base`. */
  readonly tone?: SurfacePrimitiveTone;
  /** Element to render. Defaults to `<section>` for top-level scenes; pass `'div'` for nested surfaces. */
  readonly as?: ElementType;
  readonly children?: ReactNode;
  readonly className?: string;
  /**
   * Inline-style escape hatch. Layout-affecting properties (`width`, `height`,
   * `padding`, `margin`) leak intentionally so callers can opt into
   * non-token sizing only when absolutely required; the `no-raw-spacing`
   * ESLint rule (task 16.1) flags those cases for review.
   */
  readonly style?: CSSProperties;
  readonly id?: string;
  readonly role?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-describedby'?: string;
  readonly 'data-testid'?: string;
}

function SurfaceImpl(
  {
    tone = 'base',
    as,
    children,
    className,
    style,
    ...rest
  }: SurfaceProps,
  ref: Ref<HTMLElement>,
) {
  const Component: ElementType = as ?? 'section';
  const composedStyle: CSSProperties = {
    backgroundColor: 'transparent',
    color: 'var(--color-text)',
    ...style,
  };
  return (
    <Component
      ref={ref}
      data-surface={tone}
      className={className}
      style={composedStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

/**
 * `Surface` renders a token-driven background container. See module
 * documentation for the tone → CSS variable mapping.
 */
export const Surface = forwardRef<HTMLElement, SurfaceProps>(SurfaceImpl);
Surface.displayName = 'Surface';
