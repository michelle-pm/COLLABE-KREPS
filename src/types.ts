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
