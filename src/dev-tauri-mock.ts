// Dev-only stub so the UI renders under `pnpm web:dev` where the Tauri
// runtime (window.__TAURI_INTERNALS__) does not exist. Guarded by
// import.meta.env.DEV so it is stripped from production builds entirely.
if (
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
) {
  ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ =
    {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { windowLabel: 'main', label: 'main' },
      },
      invoke: async () => undefined,
      transformCallback: () => Math.floor(Math.random() * 1e9),
      convertFileSrc: (p: string) => p,
    }
}

export {}
