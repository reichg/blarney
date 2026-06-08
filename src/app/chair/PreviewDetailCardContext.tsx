"use client";

import { createContext, useContext } from "react";

const PreviewDetailCardCloseContext = createContext<() => void>(() => {});

export const PreviewDetailCardCloseProvider =
  PreviewDetailCardCloseContext.Provider;

export function usePreviewDetailCardClose(): () => void {
  return useContext(PreviewDetailCardCloseContext);
}
