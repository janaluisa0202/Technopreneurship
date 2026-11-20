import type { SupportCategory } from '../../apps/commuter/types/support';

export type { SupportCategory };
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface ThreadMessage {
  id: string;
  senderType: 'commuter' | 'admin' | 'system';
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
  /** Set when the customer opens an admin message. */
  readAt?: string;
  /** Lets a retried send be recognised and ignored. */
  requestId?: string;
}

export interface Conversation {
  id: string;
  /** The customer account this conversation belongs to. */
  userId: string;
  category: SupportCategory;
  subject: string;
  status: ConversationStatus;
  nickname?: string;
  email?: string;
  relatedTrip?: string;
  createdAt: string;
  lastMessageAt: string;
  /** True while an admin has not opened the newest customer message. */
  unread: boolean;
  flaggedSpam: boolean;
  messages: ThreadMessage[];
}
