// ─── Palettes de couleurs ──────────────────────────────────────────────────────
// Deux thèmes : dark (par défaut, premium) et light (mode jour).
// Les couleurs de statuts, d'accentuation et de marque sont identiques dans les deux thèmes.

export interface BrandColors {
  background:      string;
  surface:         string;
  surfaceElevated: string;
  border:          string;
  primary:         string;
  primaryDark:     string;
  accent:          string;
  textPrimary:     string;
  textSecondary:   string;
  textMuted:       string;
  statusPending:    string;
  statusProcessing: string;
  statusCompleted:  string;
  statusCancelled:  string;
  statusOnHold:     string;
  statusRefunded:   string;
  statusFailed:     string;
  status: Record<string, string>;
  success: string;
  warning: string;
  error:   string;
  info:    string;
}

// Couleurs partagées entre les deux thèmes (marque + statuts)
const shared = {
  primary:     '#7C3AED',
  primaryDark: '#6D28D9',
  accent:      '#F97316',
  statusPending:    '#F59E0B',
  statusProcessing: '#3B82F6',
  statusCompleted:  '#10B981',
  statusCancelled:  '#EF4444',
  statusOnHold:     '#6B7280',
  statusRefunded:   '#8B5CF6',
  statusFailed:     '#DC2626',
  status: {
    pending:    '#F59E0B',
    processing: '#3B82F6',
    completed:  '#10B981',
    cancelled:  '#EF4444',
    'on-hold':  '#6B7280',
    refunded:   '#8B5CF6',
    failed:     '#DC2626',
  } as Record<string, string>,
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',
};

export const darkColors: BrandColors = {
  ...shared,
  background:      '#2A2A2A',
  surface:         '#353535',
  surfaceElevated: '#494949',
  border:          '#444444',
  textPrimary:     '#F9FAFB',
  textSecondary:   '#B0B0B0',
  textMuted:       '#787878',
};

export const lightColors: BrandColors = {
  ...shared,
  background:      '#F5F7FA',
  surface:         '#FFFFFF',
  surfaceElevated: '#F0F2F5',
  border:          '#E2E6EA',
  textPrimary:     '#111827',
  textSecondary:   '#4B5563',
  textMuted:       '#9CA3AF',
};
