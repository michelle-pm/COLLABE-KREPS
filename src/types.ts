export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  status?: string;
  lastSeen?: any;
}

export interface Friend {
  id: string;
  participant1: string;
  participant2: string;
  status: 'accepted' | 'pending';
  createdAt: any;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: any;
  updatedAt: any;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: any;
  read?: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  owner_uid: string;
  participant_uids: string[];
  status: 'active' | 'completed' | 'archived';
  createdAt: any;
  updatedAt: any;
}

export type UserRole = 'owner' | 'manager' | 'seller' | 'tech' | 'admin';

export interface ProjectParticipant {
  id: string; // uid
  uid: string;
  role: UserRole;
  commissionBaseRate: number;
  active: boolean;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  authorUid: string;
  text: string;
  createdAt: any;
}

export interface Booking {
  id: string;
  projectId: string;
  sellerUid: string;
  code: string;
  source: string;
  bookingDate: any;
  saleDate?: any; // If specified, used for month split
  checkIn: any;
  checkOut: any;
  total: number;
  status: 'active' | 'cancelled';
  createdAt: any;
  updatedAt: any;

  // Normalized fields (Stage 2)
  bookingDateRaw?: any;
  saleDateRaw?: any;
  checkInRaw?: any;
  checkOutRaw?: any;
  bookingDateIso?: string | null;
  saleDateIso?: string | null;
  checkInIso?: string | null;
  checkOutIso?: string | null;
  bookingMonthKey?: string | null;
  saleMonthKey?: string | null;
  checkInMonthKey?: string | null;

  // New fields (Stage 4)
  sourceFileType?: 'sellers_report' | 'full_bookings_report';
  sourceFileName?: string;
  category?: string;
  roomNumber?: string;
  dateParseError?: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  actor_uid: string;
  actor_role: string;
  project_id: string;
  month_key?: string | null;
  entity?: string;
  entity_id?: string;
  before_json?: string | null;
  after_json?: string | null;
  created_at: any;
}

export interface MonthConfig {
  id: string; // monthKey
  projectId: string;
  status: 'open' | 'locked';
  lockedAt?: any;
  lockedBy?: string;
  unlockReason?: string;
  updatedAt: any;
}

export interface CalculationSnapshot {
  id: string;
  projectId: string;
  monthKey: string;
  version: number;
  note: string;
  authorUid: string;
  createdAt: any;
  data: {
    commissions: Commission[];
    stats: any;
  };
}

export interface Plan {
  id: string;
  projectId: string;
  uid: string | null; // null for company-wide plan
  type: 'personal' | 'company';
  period: 'week' | 'month' | 'year';
  target: number;
  actual: number;
  startDate: any;
  endDate: any;
  createdAt: any;
}

export interface Penalty {
  id: string;
  projectId: string;
  uid: string;
  percent: number; // usually 0.003
  reason: string;
  weekStart: any;
  weekEnd: any;
  createdBy: string;
  createdAt: any;
}

export interface Review {
  id: string;
  projectId: string;
  uid: string;
  weekStart: any;
  weekEnd: any;
  mistakes: string[];
  comment: string;
  createdBy: string;
  createdAt: any;
}

export interface Commission {
  id: string; // uid_YYYY_MM
  projectId: string;
  uid: string;
  month: string; // YYYY-MM
  gross: number;
  cancelled: number;
  net: number;
  baseRate: number;
  bonusRate: number;
  penaltyRate: number;
  finalRate: number;
  finalAmount: number;
  updatedAt: any;
}

export interface BookingUpload {
  id: string;
  projectId: string;
  uploaderUid: string;
  fileName: string;
  status: 'processing' | 'success' | 'partial' | 'failed';
  stats?: {
    new: number;
    updated: number;
    rejected: number;
  };
  createdAt: any;
}

export interface TaskBoard {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface TaskColumn {
  id: string;
  projectId: string;
  boardId: string;
  title: string;
  order: number;
  wipLimit: number | null;
  createdAt: any;
  updatedAt: any;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  projectId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeUids: string[];
  reporterUid: string;
  watchers: string[];
  tags: string[];
  dueDate: any | null;
  startDate: any | null;
  estimateHours: number | null;
  spentHours: number | null;
  linkedBookingCode: string | null;
  linkedMonth: string | null; // YYYY-MM
  sourceType: 'general' | 'sales' | 'tech' | 'finance';
  checklist: TaskChecklistItem[];
  order: number;
  archived: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface TaskComment {
  id: string;
  projectId: string;
  taskId: string;
  authorUid: string;
  text: string;
  createdAt: any;
  updatedAt: any;
}

export interface TaskActivity {
  id: string;
  projectId: string;
  taskId: string;
  actorUid: string;
  actionType: string;
  payload: any;
  createdAt: any;
}
