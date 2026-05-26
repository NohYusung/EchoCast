"use client";

import type { LibraryServiceType } from "@/types/libraryServiceMode";

export function useServiceMode(): {
  isApiEnabled: boolean;
  isReady: boolean;
  error: Error | null;
  serviceType?: LibraryServiceType;
} {
  return {
    isApiEnabled: false,
    isReady: true,
    error: null,
    serviceType: undefined,
  };
}
