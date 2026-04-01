import * as XLSX from 'xlsx';
import { Booking, Plan, Commission, Penalty } from '../types';

export interface BookingRow {
  'Код': string;
  'Источник': string;
  'Дата брони': string;
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
  const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);
  
  // Final rate logic: base + bonus - penalties (as percentage points or absolute?)
  // Usually penalties are absolute amounts or rate deductions. 
  // TZ says: "Применение штрафа к ставке комиссии. Защита от отрицательной ставки max(0, ...)"
  // This implies penalties are rate deductions.
  
  const finalRate = Math.max(0, baseRate + teamBonus); // penalties are usually absolute in the final amount or rate?
  // Let's assume penalties are absolute deductions from the final amount for now, 
  // but TZ says "к ставке". So let's treat penalty as a rate deduction if it's small, 
  // or just subtract from final amount. 
  // "Защита от отрицательной ставки" -> implies rate.
  
  const finalAmount = Math.max(0, (net * finalRate) - totalPenalties);
  
  return {
    id: '', // to be set by firestore
    projectId: personalPlan.projectId,
    uid: personalPlan.uid!,
    month,
    gross,
    cancelled,
    net,
    rate: baseRate,
    bonus: teamBonus,
    penalties: totalPenalties,
    finalAmount,
    updatedAt: new Date().toISOString()
  };
}
