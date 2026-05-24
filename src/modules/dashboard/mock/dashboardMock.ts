import type { DashboardStats } from '@app-types/woocommerce';
import { MOCK_ORDERS } from '@modules/orders/mock/ordersMock';
import type { DashboardPeriod } from '@config/constants';

// Statistiques par période — simulées pour correspondre aux maquettes
const REVENUE_BY_PERIOD: Record<DashboardPeriod, number> = {
  today:   24741,      // Maquette 2: 24.741 F CFA
  week:    1520000,
  month:   9375000,    // Maquette 1: 9 375 000 F
  quarter: 28500000,
  year:    114200000,
  custom:  0,
};

const ORDERS_COUNT_BY_PERIOD: Record<DashboardPeriod, { pending: number; processing: number; completed: number; cancelled: number; on_hold: number }> = {
  today:   { pending: 1, processing: 2, completed: 1, cancelled: 0, on_hold: 0 },
  week:    { pending: 3, processing: 4, completed: 18, cancelled: 2, on_hold: 1 },
  month:   { pending: 8, processing: 12, completed: 605, cancelled: 5, on_hold: 2 },
  quarter: { pending: 15, processing: 28, completed: 198, cancelled: 14, on_hold: 4 },
  year:    { pending: 22, processing: 35, completed: 687, cancelled: 41, on_hold: 9 },
  custom:  { pending: 0, processing: 0, completed: 0, cancelled: 0, on_hold: 0 },
};

const CONVERSION_BY_PERIOD: Record<DashboardPeriod, number> = {
  today:   0.0357,     // 3.57%
  week:    0.052,
  month:   0.1226,     // Maquette 1: 12.26%
  quarter: 0.084,
  year:    0.079,
  custom:  0,
};

const ITEMS_SOLD_BY_PERIOD: Record<DashboardPeriod, number> = {
  today: 4, week: 32, month: 845, quarter: 2420, year: 9812, custom: 0,
};

const PERIOD_ORDER_COUNT_BY_PERIOD: Record<DashboardPeriod, number> = {
  today: 4,            // Maquette 2: 4 Commandes
  week: 28,
  month: 625,          // Maquette 1: 625 Commandes
  quarter: 259,
  year: 794,
  custom: 0,
};

const VISITORS_BY_PERIOD: Record<DashboardPeriod, number> = {
  today: 112,
  week: 540,
  month: 3241,         // Maquette 1: 3 241 Visiteurs
  quarter: 9210,
  year: 34100,
  custom: 0,
};

export function getMockDashboard(period: DashboardPeriod): DashboardStats {
  return {
    revenue: {
      today:   REVENUE_BY_PERIOD.today,
      week:    REVENUE_BY_PERIOD.week,
      month:   REVENUE_BY_PERIOD.month,
      quarter: REVENUE_BY_PERIOD.quarter,
      year:    REVENUE_BY_PERIOD.year,
      custom:  REVENUE_BY_PERIOD.custom,
    },
    order_counts: ORDERS_COUNT_BY_PERIOD[period],
    recent_orders: MOCK_ORDERS.slice(0, 5),
    period_order_count: PERIOD_ORDER_COUNT_BY_PERIOD[period],
    period_items_sold: ITEMS_SOLD_BY_PERIOD[period],
    conversion_rate: CONVERSION_BY_PERIOD[period],
  };
}

export { VISITORS_BY_PERIOD };
