export interface PromptHistoryEntry {
  id: string;
  diagram_id?: string | null;
  prompt_text: string;
  operation_type: 'creation' | 'improvement';
  created_at: string;
  used_at: string;
}

export interface PaginatedPromptHistory {
  items: PromptHistoryEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
