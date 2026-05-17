/**
 * Text — type-step-driven text node.
 *
 * The only typographic prop the component accepts is `step` (the
 * `TypeStep` union: display | headline | title | body | small | caption).
 * Every concrete font-size / line-height / letter-spacing / weight value
 * is read from `tokens.ts`'s `typeScale`. Callers cannot pass a literal
 * numeric font size — there is no `fontSize` prop and the `style` escape
 * hatch deliberately omits the typographic properties below by composing
 * them after spread. (The `no-raw-spacing`-adjacent ESLint rule from
 * task 16.1 will flag any caller that tries to override font-size via
 * className.)
 *
 * R4.5 / R4.6 guard: when `step === 'display'` and the resolved
 * `fontSize > 48 CSS px`, the component asserts that letter-spacing
 * ≤ -0.02em and line-height ≤ 1.1. The current `display` step in
 * `tokens.ts` satisfies the bound (fontSize: 96, letterSpacing: -0.03,
 * lineHeight: 1.05); the runtime guard is a belt-and-braces check so
 * future drift in the token table is caught immediately rather than
 * surfacing as a visual regression.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 4.7
 */

import {
  forwardRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';
import type { FontFamilyRole, TypeStep } from '../tokens.types';
import { fontFamilyStacks, typeScale } from '../tokens';

export type TextAlign = 'start' | 'center' | 'end' | 'justify';
export type TextWeight = 400 | 500 | 600 | 700;
export type TextTone = 'default' | 'muted' | 'subtle' | 'inherit';

const ALIGN_TO_CSS: Readonly<Record<TextAlign, CSSProperties['textAlign']>> = {
  start: 'left',
  center: 'center',
  end: 'right',
  justify: 'justify',
};

const TONE_TO_COLOR: Readonly<Record<TextTone, string | undefined>> = {
  default: 'var(--color-text)',
  muted: 'var(--color-text-muted)',
  subtle: 'var(--color-text-subtle)',
  inherit: undefined,
};

/**
 * Default semantic element per type step. Callers may override via `as` —
 * for example, a non-heading title in a footer block can pass `as="p"`.
 */
const DEFAULT_AS_FOR_STEP: Readonly<Record<TypeStep, ElementType>> = {
  display: 'h1',
  headline: 'h2',
  title: 'h3',
  body: 'p',
  small: 'p',
  caption: 'span',
};

/**
 * R4.5 / R4.6 runtime guard. Run once per `display` render in dev. Throws
 * a clear error when the registered `display` step would exceed the
 * tightening bounds for headings whose computed font size > 48 px.
 */
function assertDisplayBoundsOrThrow(): void {
  const v = typeScale.display;
  if (v.fontSize > 48) {
    if (v.letterSpacing > -0.02) {
      throw new Error(
        `[Text] typeScale.display.letterSpacing must be ≤ -0.02em when fontSize > 48px ` +
          `(got ${v.letterSpacing}em at fontSize ${v.fontSize}px). ` +
          'Update src/design-system/tokens.ts to satisfy R4.6.',
      );
    }
    if (v.lineHeight > 1.1) {
      throw new Error(
        `[Text] typeScale.display.lineHeight must be ≤ 1.1 when fontSize > 48px ` +
          `(got ${v.lineHeight} at fontSize ${v.fontSize}px). ` +
          'Update src/design-system/tokens.ts to satisfy R4.6.',
      );
    }
  }
}

// Run the guard once at module-load so any drift fails the first import.
assertDisplayBoundsOrThrow();

export interface TextProps {
  /** Required type-scale step. Literal font sizes are not accepted. */
  readonly step: TypeStep;
  /** Element to render. Defaults to a semantic element per step. */
  readonly as?: ElementType;
  /** Override font-weight while keeping the step's other typographic values. */
  readonly weight?: TextWeight;
  /** Font-family stack to use. Defaults to `body`. */
  readonly family?: FontFamilyRole;
  /** Text-color tone. Defaults to `default`. */
  readonly tone?: TextTone;
  /** Text alignment. Defaults to `start`. */
  readonly align?: TextAlign;
  /**
   * When true, applies `text-wrap: balance` for tighter line balancing on
   * headlines. Visual-only — does not affect any typographic token.
   */
  readonly balance?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
  /**
   * Inline-style escape hatch. The component composes typographic
   * properties *after* the caller's `style` so callers cannot override
   * font-size, line-height, letter-spacing, or font-weight via inline
   * style. (R4.4: typography always resolves via tokens.)
   */
  readonly style?: CSSProperties;
  readonly id?: string;
  readonly role?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-hidden'?: boolean;
  readonly 'data-testid'?: string;
}

function TextImpl(
  {
    step,
    as,
    weight,
    family = 'body',
    tone = 'default',
    align = 'start',
    balance = false,
    children,
    className,
    style,
    ...rest
  }: TextProps,
  ref: Ref<HTMLElement>,
) {
  const stepValue = typeScale[step];
  const Component: ElementType = as ?? DEFAULT_AS_FOR_STEP[step];

  // Compose token values *after* the caller's style so caller cannot
  // override font-size / line-height / letter-spacing / weight inline
  // (R4.4 keeps typography token-driven).
  const composedStyle: CSSProperties = {
    ...style,
    fontFamily: fontFamilyStacks[family],
    fontSize: `${stepValue.fontSize}px`,
    lineHeight: stepValue.lineHeight,
    letterSpacing: `${stepValue.letterSpacing}em`,
    fontWeight: weight ?? stepValue.fontWeight,
    textAlign: ALIGN_TO_CSS[align],
    color: TONE_TO_COLOR[tone],
    margin: 0,
    textWrap: balance ? 'balance' : undefined,
  };

  return (
    <Component
      ref={ref}
      data-text-step={step}
      data-text-family={family}
      className={className}
      style={composedStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

export const Text = forwardRef<HTMLElement, TextProps>(TextImpl);
Text.displayName = 'Text';
