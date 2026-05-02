import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Référence globale au NavigationContainer — permet de naviguer depuis les handlers
// de notifications push (hors contexte React, pas d'accès à useNavigation).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
