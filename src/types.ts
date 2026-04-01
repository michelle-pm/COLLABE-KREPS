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
  cancelDate?: any;
  checkIn: any;
  checkOut: any;
  category: string;
  roomNumber: string;
  total: number;
  status: 'active' | 'cancelled';
  createdAt: any;
}

export interface Plan {
  id: string;
  projectId: string;
  uid?: string; // If undefined, it's a company-wide plan
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
  amount: number;
  reason: string;
  date: any;
  createdAt: any;
}

export interface Commission {
  id: string;
  projectId: string;
  uid: string;
  month: string; // YYYY-MM
  gross: number;
  cancelled: number;
  net: number;
  rate: number;
  bonus: number;
  penalties: number;
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
