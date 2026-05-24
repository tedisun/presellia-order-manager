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
  primary:     '#8B5CF6',
  primaryDark: '#7C3AED',
  accent:      '#F43F5E',
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
  background:      '#0B0F19',
  surface:         '#151D30',
  surfaceElevated: '#222F4B',
  border:          '#1E293B',
  textPrimary:     '#F8FAFC',
  textSecondary:   '#94A3B8',
  textMuted:       '#64748B',
};

export const lightColors: BrandColors = {
  ...shared,
  background:      '#F8FAFC',
  surface:         '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border:          '#E2E8F0',
  textPrimary:     '#0F172A',
  textSecondary:   '#475569',
  textMuted:       '#94A3B8',
};
