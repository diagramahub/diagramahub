import { useCallback, useEffect, useState } from 'react';
import apiService from '../services/api';
import type { PublishedSource } from '../types/community';

/**
 * The user's published diagrams by diagram id, to mark them as public in their
 * lists. Markers are optional: if the request fails, nothing is marked.
 */
export function usePublishedDiagrams() {
  const [published, setPublished] = useState<Map<string, PublishedSource>>(() => new Map());

  const refreshPublished = useCallback(async () => {
    try {
      const list = await apiService.getMyPublishedDiagrams();
      setPublished(new Map(list.map((p) => [p.diagram_id, p])));
    } catch {
      /* keep the current markers */
    }
  }, []);

  useEffect(() => {
    void refreshPublished();
  }, [refreshPublished]);

  return { published, refreshPublished };
}
