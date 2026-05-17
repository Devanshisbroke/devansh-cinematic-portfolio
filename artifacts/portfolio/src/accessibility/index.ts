export {
  readReducedMotion,
  writeReducedMotion,
  clearReducedMotionPref,
  subscribe as subscribeReducedMotion,
  REDUCED_MOTION_HYDRATION_SCRIPT,
} from './reduced-motion-store';

export {
  readTheme,
  writeTheme,
  subscribeTheme,
  THEME_HYDRATION_SCRIPT,
} from './theme-store';
export type { Theme } from './theme-store';

export {
  setMainContentRef,
  getMainContent,
  focusMain,
  useMainContentRef,
  checkHeadingHierarchy,
  useHeadingHierarchyAssertion,
  useFocusTrap,
  manageHeadingOrder,
} from './focus-management';

export {
  REDUNDANT_CUES,
  assertRedundantCue,
} from './redundant-cues';
export type { RedundantCueEntry, CueChannel } from './redundant-cues';
