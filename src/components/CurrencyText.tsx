import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';

interface Props {
  amount: number | string;
  currency?: string;
  style?: StyleProp<TextStyle>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  bold?: boolean;
  color?: string;
}

export default function CurrencyText({ amount, currency = 'XOF', style, size = 'md', bold = false, color }: Props) {
  const { colors } = useTheme();
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  const cleanCurrency = currency.toUpperCase();
  let displayText = '';

  if (cleanCurrency === 'XOF' || cleanCurrency === 'FCFA') {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    displayText = `${formatted} F`;
  } else if (cleanCurrency === 'USD') {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    displayText = `$${formatted}`;
  } else if (cleanCurrency === 'EUR') {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    displayText = `${formatted} €`;
  } else {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    displayText = `${formatted} ${currency}`;
  }

  const sizeMap: Record<string, number> = {
    sm:  BRANDING.fonts.sizeSM,
    md:  BRANDING.fonts.sizeMD,
    lg:  BRANDING.fonts.sizeLG,
    xl:  BRANDING.fonts.sizeXL,
    xxl: BRANDING.fonts.sizeXXL,
  };

  return (
    <Text style={[{ fontSize: sizeMap[size], fontWeight: bold ? BRANDING.fonts.weightBold : BRANDING.fonts.weightRegular, color: color ?? colors.textPrimary }, style]}>
      {displayText}
    </Text>
  );
}
