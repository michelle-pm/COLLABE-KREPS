import { Booking, Plan, ProjectParticipant } from '../types';

export interface CommissionResult {
  uid: string;
  netSales: number;
  baseRate: number;
  bonusRate: number;
  penaltyRate: number;
  finalRate: number;
  amount: number;
  achievement: number;
}

/**
 * Stage 4: Commission Logic V2
 * - Base: 3/5/6 (3% default, 5% if >= 50% plan, 6% if >= 80% plan)
 * - Fines: -1% if plan < 50%
 * - Bonus: +2% if company plan 100%
 */
export function calculateCommissions(
  bookings: Booking[],
  personalPlans: Plan[],
  companyPlan: Plan | null,
  participants: ProjectParticipant[],
  totalCompanyNet: number
): CommissionResult[] {
  return personalPlans.map(plan => {
    if (!plan.uid) return null;

    const userBookings = bookings.filter(b => b.sellerUid === plan.uid);
    const netSales = userBookings.reduce((sum, b) => sum + (b.status === 'cancelled' ? 0 : b.total), 0);
    const achievement = plan.target > 0 ? (netSales / plan.target) * 100 : 0;

    const participant = participants.find(p => p.uid === plan.uid);
    
    // 1. Base Rate (3/5/6 logic)
    let baseRate = participant?.commissionBaseRate || 0.03;
    if (achievement >= 80) baseRate = 0.06;
    else if (achievement >= 50) baseRate = 0.05;

    // 2. Fines (-1% if achievement < 50%)
    const penaltyRate = achievement < 50 ? -0.01 : 0;

    // 3. Company Bonus (+2% if company plan 100%)
    const companyAchievement = companyPlan && companyPlan.target > 0 ? (totalCompanyNet / companyPlan.target) * 100 : 0;
    const bonusRate = companyAchievement >= 100 ? 0.02 : 0;

    const finalRate = Math.max(0, baseRate + penaltyRate + bonusRate);
    const amount = netSales * finalRate;

    return {
      uid: plan.uid,
      netSales,
      baseRate,
      bonusRate,
      penaltyRate,
      finalRate,
      amount,
      achievement
    };
  }).filter((r): r is CommissionResult => r !== null);
}
