import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface PresentationContextValue {
  isPresentationMode: boolean;
  setPresentationMode: (v: boolean) => void;
}

const PresentationContext = createContext<PresentationContextValue>({
  isPresentationMode: false,
  setPresentationMode: () => {},
});

/** Provider — wrap around the editor route so SidebarLayout and DiagramEditorPage share state */
export function PresentationProvider({ children }: { children: ReactNode }) {
  const [isPresentationMode, setPresentationMode] = useState(false);
  return (
    <PresentationContext.Provider value={{ isPresentationMode, setPresentationMode }}>
      {children}
    </PresentationContext.Provider>
  );
}

/** Read-only — used by SidebarLayout to hide when presentation is active */
export function usePresentationMode(): boolean {
  return useContext(PresentationContext).isPresentationMode;
}

/** Write — used by DiagramEditorPage to signal fullscreen state */
export function useSetPresentationMode(): (v: boolean) => void {
  return useContext(PresentationContext).setPresentationMode;
}
