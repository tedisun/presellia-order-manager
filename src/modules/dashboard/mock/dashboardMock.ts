import type { DashboardStats } from '@app-types/woocommerce';
import { MOCK_ORDERS } from '@modules/orders/mock/ordersMock';
import type { DashboardPeriod } from '@config/constants';

// Statistiques par période — simulées
const REVENUE_BY_PERIOD: Record<DashboardPeriod, number> = {
  today:   47500,
  week:    312000,
  month:   1_250_000,
  quarter: 3_800_000,
  year:    14_200_000,
};

const ORDERS_COUNT_BY_PERIOD: Record<DashboardPeriod, { pending: number; processing: number; completed: number; cancelled: number; on_hold: number }> = {
  today:   { pending: 1, processing: 1, completed: 1, cancelled: 0, on_hold: 0 },
  week:    { pending: 3, processing: 4, completed: 18, cancelled: 2, on_hold: 1 },
  month:   { pending: 8, processing: 12, completed: 67, cancelled: 5, on_hold: 2 },
  quarter: { pending: 15, processing: 28, completed: 198, cancelled: 14, on_hold: 4 },
  year:    { pending: 22, processing: 35, completed: 687, cancelled: 41, on_hold: 9 },
};

const CONVERSION_BY_PERIOD: Record<DashboardPeriod, number> = {
  today:   0.68,
  week:    0.71,
  month:   0.65,
  quarter: 0.63,
  year:    0.67,
};

const ITEMS_SOLD_BY_PERIOD: Record<DashboardPeriod, number> = {
  today: 2, week: 14, month: 58, quarter: 172, year: 634,
};

const PERIOD_ORDER_COUNT_BY_PERIOD: Record<DashboardPeriod, number> = {
  today: 2, week: 28, month: 94, quarter: 259, year: 794,
};

export function getMockDashboard(period: DashboardPeriod): DashboardStats {
  return {
    revenue: {
      today:   REVENUE_BY_PERIOD.today,
      week:    REVENUE_BY_PERIOD.week,
      month:   REVENUE_BY_PERIOD.month,
      quarter: REVENUE_BY_PERIOD.quarter,
      year:    REVENUE_BY_PERIOD.year,
    },
    order_counts: ORDERS_COUNT_BY_PERIOD[period],
    recent_orders: MOCK_ORDERS.slice(0, 5),
    period_order_count: PERIOD_ORDER_COUNT_BY_PERIOD[period],
    period_items_sold: ITEMS_SOLD_BY_PERIOD[period],
    conversion_rate: CONVERSION_BY_PERIOD[period],
  };
}
