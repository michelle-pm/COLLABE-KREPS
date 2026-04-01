import * as XLSX from 'xlsx';
import { Booking, Plan, Commission, Penalty } from '../types';

export interface BookingRow {
  'Код': string;
  'Источник': string;
  'Дата брони': string;
  'Дата продажи'?: string;
  'Дата отмены': string;
  'Заезд': string;
  'Выезд': string;
  'Категория': string;
  'Номер': string;
  'Итого': number;
  'Seller'?: string; // Optional if mapped later
}

export function parseBookingExcel(buffer: ArrayBuffer): BookingRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames.find(name => name.includes('Бронирования')) || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

export function calculateCommission(
  bookings: Booking[],
  personalPlan: Plan,
  companyPlan: Plan,
  penalties: Penalty[]
): Commission {
  const month = personalPlan.startDate.toISOString().substring(0, 7); // YYYY-MM
  
  const gross = bookings.reduce((sum, b) => sum + b.total, 0);
  const cancelled = bookings.filter(b => b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0);
  const net = gross - cancelled;
  
  const achievementRate = personalPlan.target > 0 ? (net / personalPlan.target) * 100 : 0;
  const companyAchievementRate = companyPlan.target > 0 ? (companyPlan.actual / companyPlan.target) * 100 : 0;
  
  let baseRate = 0;
  if (achievementRate < 50) baseRate = 0.03;
  else if (achievementRate < 80) baseRate = 0.05;
  else baseRate = 0.06;
  
  const teamBonus = companyAchievementRate >= 100 ? 0.02 : 0;
  const totalPenaltyRate = penalties.reduce((sum, p) => sum + p.percent, 0);
  
  const finalRate = Math.max(0, baseRate + teamBonus - totalPenaltyRate);
  const finalAmount = Math.max(0, net * finalRate);
  
  return {
    id: '', // to be set by firestore
    projectId: personalPlan.projectId,
    uid: personalPlan.uid!,
    month,
    gross,
    cancelled,
    net,
    baseRate,
    bonusRate: teamBonus,
    penaltyRate: totalPenaltyRate,
    finalRate,
    finalAmount,
    updatedAt: new Date().toISOString()
  };
}
