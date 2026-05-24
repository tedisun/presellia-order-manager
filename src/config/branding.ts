// ─── Branding Presellia ───────────────────────────────────────────────────────
// Point de personnalisation unique. Pour adapter l'app à un autre business :
// modifier uniquement ce fichier.

export const BRANDING = {
  // Identité
  appName: 'Presellia Orders',
  businessName: 'Presellia',
  tagline: 'Gestion premium des commandes',

  // Monnaie
  currency: 'F CFA',
  currencyCode: 'XOF',
  locale: 'fr-FR',

  // Couleurs — dark mode premium (obsidienne & violet néon)
  colors: {
    // Fonds
    background: '#0B0F19',      // obsidienne profonde
    surface: '#151D30',         // cartes
    surfaceElevated: '#222F4B', // inputs, modals
    border: '#1E293B',          // séparateurs

    // Marque
    primary: '#8B5CF6',         // violet néon
    primaryDark: '#7C3AED',     // état pressé
    accent: '#F43F5E',          // rose néon vif

    // Texte
    textPrimary: '#F8FAFC',     // blanc doux
    textSecondary: '#94A3B8',   // gris ardoise moyen
    textMuted: '#64748B',       // gris ardoise doux

    // Statuts commandes (flat keys pour rétrocompat)
    statusPending:    '#F59E0B',
    statusProcessing: '#3B82F6',
    statusCompleted:  '#10B981',
    statusCancelled:  '#EF4444',
    statusOnHold:     '#6B7280',
    statusRefunded:   '#8B5CF6',
    statusFailed:     '#DC2626',

    // Statuts commandes (map indexée par OrderStatus)
    status: {
      pending:    '#F59E0B',
      processing: '#3B82F6',
      completed:  '#10B981',
      cancelled:  '#EF4444',
      'on-hold':  '#6B7280',
      refunded:   '#8B5CF6',
      failed:     '#DC2626',
    } as Record<string, string>,

    // Sémantiques
    success: '#10B981',   // emerald
    warning: '#F59E0B',   // amber
    error:   '#EF4444',   // red
    info:    '#3B82F6',   // blue
  },

  // Typographie
  fonts: {
    sizeXS:  11,
    sizeSM:  13,
    sizeMD:  15,
    sizeLG:  17,
    sizeXL:  20,
    sizeXXL: 24,
    weightRegular: '400' as const,
    weightMedium:  '500' as const,
    weightSemiBold:'600' as const,
    weightBold:    '700' as const,
  },

  // Espacement
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  // Rayons de bordure
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    full: 999,
  },
} as const;

export type { BrandColors } from './themes';
