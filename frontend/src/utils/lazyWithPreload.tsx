import { lazy, type ComponentType } from 'react';

type PageModule<P> = { default: ComponentType<P> };

export type PreloadableComponent<P extends object> = ComponentType<P> & {
  /** Start (or reuse) the chunk download; resolves when the module is ready. */
  preload: () => Promise<PageModule<P>>;
};

/**
 * `React.lazy` with a `preload()` handle that skips Suspense once loaded.
 *
 * A plain `lazy()` component always suspends on its first render, even when
 * its chunk is already downloaded, and React 19 then holds the revealed content
 * for ~300 ms after a fallback is shown (Suspense throttling). Once `preload()`
 * has resolved, this component renders the loaded module directly, so a route
 * whose chunk was fetched ahead of time never shows the fallback nor pays that
 * delay.
 */
export function lazyWithPreload<P extends object>(
  factory: () => Promise<PageModule<P>>,
): PreloadableComponent<P> {
  let Loaded: ComponentType<P> | null = null;
  let pending: Promise<PageModule<P>> | null = null;

  const preload = () => {
    pending ??= factory().then((module) => {
      Loaded = module.default;
      return module;
    });
    return pending;
  };

  const Lazy = lazy(preload);

  function Preloadable(props: P) {
    // Before the module is ready, fall back to the regular lazy path (Suspense).
    // A suspended <Lazy> never commits, so switching to <Loaded> on the retry
    // doesn't remount anything.
    return Loaded ? <Loaded {...props} /> : <Lazy {...props} />;
  }

  return Object.assign(Preloadable, { preload });
}
