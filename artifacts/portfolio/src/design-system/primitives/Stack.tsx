/**
 * Stack — vertical, spacing-token-driven flex stack.
 *
 * Both `gapStep` and `paddingStep` are typed as `SpacingStep` (the union of
 * the ten valid spacing identifiers), so passing a literal number — `gapStep={16}`
 * or `gapStep="16"` — is a TypeScript error at the call site. Concrete values
 * are resolved through the `--space-*` CSS custom properties published by
 * `styles/theme.css`, which mirror `tokens.ts` exactly.
 *
 * Stack does not set a width, height, background, or color. It only owns
 * spacing and main-axis flow — surfaces, type, and layout sizing are the
 * caller's responsibility.
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

export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

const ALIGN_TO_CSS: Readonly<Record<StackAlign, CSSProperties['alignItems']>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY_TO_CSS: Readonly<Record<StackJustify, CSSProperties['justifyContent']>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

export interface StackProps {
  /** Required spacing token used as `gap`. Literal numbers are a TS error. */
  readonly gapStep: SpacingStep;
  /** Optional spacing token applied to all four sides via `padding`. */
  readonly paddingStep?: SpacingStep;
  /** Element to render. Defaults to `<div>`. */
  readonly as?: ElementType;
  /** Cross-axis alignment. Defaults to `stretch`. */
  readonly align?: StackAlign;
  /** Main-axis justification. Defaults to `start`. */
  readonly justify?: StackJustify;
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

function StackImpl(
  {
    gapStep,
    paddingStep,
    as,
    align = 'stretch',
    justify = 'start',
    children,
    className,
    style,
    ...rest
  }: StackProps,
  ref: Ref<HTMLElement>,
) {
  const Component: ElementType = as ?? 'div';
  const composedStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `var(--space-${gapStep})`,
    padding: paddingStep ? `var(--space-${paddingStep})` : undefined,
    alignItems: ALIGN_TO_CSS[align],
    justifyContent: JUSTIFY_TO_CSS[justify],
    ...style,
  };
  return (
    <Component
      ref={ref}
      data-stack-gap={gapStep}
      data-stack-padding={paddingStep}
      className={className}
      style={composedStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

export const Stack = forwardRef<HTMLElement, StackProps>(StackImpl);
Stack.displayName = 'Stack';
