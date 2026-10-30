'use client';
import { createContext, useContext } from 'react';
export type DraftGuard = {
  register: (fn: (() => Promise<boolean>) | null) => void;
  flush: () => Promise<boolean>;
};
export const DraftContext = createContext<DraftGuard>({
  register: () => {},
  flush: async () => true,
});
export const useDraftGuard = () => useContext(DraftContext);
