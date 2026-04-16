// ─── Branding Presellia ───────────────────────────────────────────────────────
// Point de personnalisation unique. Pour adapter l'app à un autre business :
// modifier uniquement ce fichier.

export const BRANDING = {
  // Identité
  appName: 'Order Manager',
  businessName: 'Presellia',
  tagline: 'Gestion des commandes',

  // Monnaie
  currency: 'F CFA',
  currencyCode: 'XOF',
  locale: 'fr-FR',

  // Couleurs — dark mode premium (neutral black, sans teinte bleue)
  colors: {
    // Fonds — medium dark (shades de gris chauds, contraste marqué entre niveaux)
    background: '#2A2A2A',      // fond principal
    surface: '#353535',         // cartes, surfaces
    surfaceElevated: '#494949', // modals, bottom sheets, inputs
    border: '#444444',          // séparateurs

    // Marque
    primary: '#7C3AED',         // violet vif Presellia
    primaryDark: '#6D28D9',     // état pressé
    accent: '#F97316',          // orange vif

    // Texte
    textPrimary: '#F9FAFB',     // blanc légèrement doux
    textSecondary: '#B0B0B0',   // gris moyen (éclairci pour fond #2A)
    textMuted: '#787878',       // gris doux (éclairci pour fond #2A)

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
