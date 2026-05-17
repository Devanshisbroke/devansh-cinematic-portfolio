/**
 * Inline — horizontal, spacing-token-driven flex group.
 *
 * Mirror of `Stack` along the row axis. Both `gapStep` and `paddingStep` are
 * typed as `SpacingStep`, so any attempt to pass a literal `gapStep={12}` is
 * a TypeScript error. Concrete pixel values are resolved through the
 * `--space-*` CSS custom properties published by `styles/theme.css`.
 *
 * Inline does not set width, height, background, or color. It only owns
 * spacing, main-axis flow, and wrap behaviour.
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
import type { SpacingStep } from '../tokens.types';

export type InlineAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
export type InlineJustify = 'start' | 'center' | 'end' | 'between' | 'around';

const ALIGN_TO_CSS: Readonly<Record<InlineAlign, CSSProperties['alignItems']>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  baseline: 'baseline',
  stretch: 'stretch',
};

const JUSTIFY_TO_CSS: Readonly<Record<InlineJustify, CSSProperties['justifyContent']>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

export interface InlineProps {
  /** Required spacing token used as `gap`. Literal numbers are a TS error. */
  readonly gapStep: SpacingStep;
  /** Optional spacing token applied to all four sides via `padding`. */
  readonly paddingStep?: SpacingStep;
  /** Element to render. Defaults to `<div>`. */
  readonly as?: ElementType;
  /** Cross-axis alignment. Defaults to `center`. */
  readonly align?: InlineAlign;
  /** Main-axis justification. Defaults to `start`. */
  readonly justify?: InlineJustify;
  /** When true, items wrap to additional rows on overflow. Defaults to `false`. */
  readonly wrap?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
  /** Inline-style escape hatch — never used to override `gap` or `padding`. */
  readonly style?: CSSProperties;
  readonly id?: string;
  readonly role?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'data-testid'?: string;
}

function InlineImpl(
  {
    gapStep,
    paddingStep,
    as,
    align = 'center',
    justify = 'start',
    wrap = false,
    children,
    className,
    style,
    ...rest
  }: InlineProps,
  ref: Ref<HTMLElement>,
) {
  const Component: ElementType = as ?? 'div';
  const composedStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: `var(--space-${gapStep})`,
    padding: paddingStep ? `var(--space-${paddingStep})` : undefined,
    alignItems: ALIGN_TO_CSS[align],
    justifyContent: JUSTIFY_TO_CSS[justify],
    flexWrap: wrap ? 'wrap' : 'nowrap',
    ...style,
  };
  return (
    <Component
      ref={ref}
      data-inline-gap={gapStep}
      data-inline-padding={paddingStep}
      className={className}
      style={composedStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

export const Inline = forwardRef<HTMLElement, InlineProps>(InlineImpl);
Inline.displayName = 'Inline';
