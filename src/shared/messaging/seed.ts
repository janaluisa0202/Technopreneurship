import type { Conversation, ThreadMessage } from './types';

/** Demo conversations. They belong to the seeded customer accounts (user-1 … user-4) so those customers see them after login. */
export function createSeedConversations(now = Date.now()): Conversation[] {
  const at = (minutes: number) => new Date(now + minutes * 60000).toISOString();
  const msg = (id: string, who: 'commuter' | 'admin', userId: string, name: string, message: string, minutes: number): ThreadMessage => ({
    id, senderType: who, senderId: who === 'admin' ? 'adm-2' : userId, senderName: name, message, createdAt: at(minutes),
  });
  return [
    { id: 'conv-1', userId: 'user-1', category: 'fare', subject: 'Incorrect fares', status: 'open', nickname: 'Mika Santos', email: 'mika@sakaywise.demo', relatedTrip: 'UST Frassati → SM North', createdAt: at(-42), lastMessageAt: at(-12), unread: true, flaggedSpam: false, messages: [
      msg('m-1a', 'commuter', 'user-1', 'Mika Santos', 'Hi! The fare shown for UST to SM North looks higher than what I usually pay as a student.', -42),
      msg('m-1b', 'commuter', 'user-1', 'Mika Santos', 'Is the student discount applied automatically?', -12),
    ] },
    { id: 'conv-2', userId: 'user-2', category: 'queue', subject: 'Queue reports', status: 'pending', nickname: 'Carlo Reyes', createdAt: at(-300), lastMessageAt: at(-95), unread: false, flaggedSpam: false, messages: [
      msg('m-2a', 'commuter', 'user-2', 'Carlo Reyes', 'The queue at One Ayala says low but there are about 40 people waiting.', -300),
      msg('m-2b', 'admin', 'user-2', 'Ops Moderator', 'Thanks Carlo! We are checking the latest reports for that terminal and will update the status.', -95),
    ] },
    { id: 'conv-3', userId: 'user-3', category: 'roadwatch', subject: 'RoadWatch advisories', status: 'open', nickname: 'Bea Cruz', email: 'bea@sakaywise.demo', createdAt: at(-1500), lastMessageAt: at(-1480), unread: true, flaggedSpam: false, messages: [
      msg('m-3a', 'commuter', 'user-3', 'Bea Cruz', 'Is España still flooded near the boarding area? The alert has been up since morning.', -1500),
    ] },
    { id: 'conv-4', userId: 'user-4', category: 'bug', subject: 'Application bugs', status: 'resolved', nickname: 'Jun Dela Cruz', createdAt: at(-5800), lastMessageAt: at(-5600), unread: false, flaggedSpam: false, messages: [
      msg('m-4a', 'commuter', 'user-4', 'Jun Dela Cruz', 'The saved trips screen shows a blank list after I reopen the app.', -5800),
      msg('m-4b', 'admin', 'user-4', 'Admin Demo', 'Thanks for flagging this. A fix is included in the latest update; please refresh and let us know.', -5600),
    ] },
  ];
}
