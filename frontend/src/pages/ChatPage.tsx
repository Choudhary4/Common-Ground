import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChatCircleDots,
  UsersThree,
  Plus,
  ArrowLeft,
  PaperPlaneTilt,
  CircleNotch,
  X,
  Check,
  UserPlus,
  UserMinus,
  SignOut,
  Sparkle,
  CalendarBlank,
  MapPin,
  Prohibit,
  PencilSimple,
  ArrowBendUpLeft,
  Smiley,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { Avatar, GROUP_PRESET_AVATARS } from '../components/Avatar';
import { apiRequest, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

interface RoomMember {
  userId: string;
  nickname: string;
  avatar: string | null;
  online?: boolean;
}

interface ChatRoomItem {
  _id: string;
  type: 'DIRECT' | 'GROUP';
  name: string;
  description?: string;
  avatar: string | null;
  createdBy?: string;
  members: RoomMember[];
  lastMessageText: string;
  lastMessageAt: string;
  unreadCount?: number;
}

interface ChatMessageItem {
  _id: string;
  roomId: string;
  senderId: string;
  senderNickname: string;
  senderAvatar: string | null;
  text: string;
  replyTo?: {
    messageId: string;
    senderNickname: string;
    text: string;
  } | null;
  reactions?: Array<{
    emoji: string;
    userId: string;
  }>;
  createdAt: string;
}

const REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '🙏'];

interface HostelTraveller {
  userId: string;
  nickname: string;
  avatar: string | null;
  status?: string | null;
  isOnline?: boolean;
}

interface TravellerProfile {
  userId: string;
  nickname: string;
  avatar: string | null;
  interests: string[];
  socialStatus: string | null;
  isOnline?: boolean;
  joinedAt: string;
  hostedActivities: Array<{
    _id: string;
    title: string;
    category: string;
    startTime: string;
    meetingPoint: string;
  }>;
}

const VIBE_LABELS: Record<string, string> = {
  OPEN_TO_MEETING: 'Open to meeting',
  UP_FOR_ACTIVITIES: 'Up for activities',
  LOOKING_FOR_COMPANY: 'Looking for company',
  JUST_CHILLING: 'Just chilling',
};

export function ChatPage() {
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [readBy, setReadBy] = useState<Record<string, string>>({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessageItem | null>(null);
  const [reactPickerMsgId, setReactPickerMsgId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Create group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(GROUP_PRESET_AVATARS[0]);
  const [hostelTravellers, setHostelTravellers] = useState<HostelTraveller[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Group details & members modal
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupAvatar, setEditGroupAvatar] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);

  // Traveller profile modal (in-chat)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<TravellerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  // Mobile virtual keyboard visualViewport lock (keeps header pinned at top when keyboard opens)
  const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roomId) {
      setViewportStyle({});
      return;
    }

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const syncViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setViewportStyle({
        height: `${vv.height}px`,
        top: `${vv.offsetTop}px`,
      });
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    };

    syncViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncViewport);
    vv?.addEventListener('scroll', syncViewport);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      vv?.removeEventListener('resize', syncViewport);
      vv?.removeEventListener('scroll', syncViewport);
    };
  }, [roomId]);

  const loadRooms = useCallback(async () => {
    try {
      const [res, discRes] = await Promise.all([
        apiRequest<{ rooms: ChatRoomItem[] }>('/chat/rooms'),
        apiRequest<{ travellers: HostelTraveller[] }>('/traveller/discover').catch(() => ({
          travellers: [],
        })),
      ]);
      setRooms(res.rooms);
      setHostelTravellers(discRes.travellers);
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        for (const r of res.rooms) {
          for (const m of r.members) {
            if (m.online) next.add(m.userId);
            else next.delete(m.userId);
          }
        }
        for (const t of discRes.travellers) {
          if (t.isOnline) next.add(t.userId);
        }
        return next;
      });
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMsgs(true);
    try {
      const res = await apiRequest<{
        messages: ChatMessageItem[];
        readBy?: Record<string, string>;
      }>(`/chat/rooms/${id}/messages`);
      setMessages(res.messages);
      setReadBy(res.readBy ?? {});
      setRooms((prev) => prev.map((r) => (r._id === id ? { ...r, unreadCount: 0 } : r)));
      window.dispatchEvent(new Event('chat:read'));
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms, roomId]);

  useEffect(() => {
    if (roomId) {
      void loadMessages(roomId);
    } else {
      setMessages([]);
      setReadBy({});
    }
  }, [roomId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    const onMessage = (msg: ChatMessageItem) => {
      if (roomId && msg.roomId === roomId) {
        setTypingUsers((prev) => {
          if (!(msg.senderId in prev)) return prev;
          const next = { ...prev };
          delete next[msg.senderId];
          return next;
        });
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
        if (msg.senderId !== user?.id) {
          void apiRequest(`/chat/rooms/${roomId}/read`, { method: 'POST' })
            .then(() => {
              setRooms((prev) =>
                prev.map((r) => (r._id === roomId ? { ...r, unreadCount: 0 } : r))
              );
              window.dispatchEvent(new Event('chat:read'));
            })
            .catch(() => {});
        }
      }
      void loadRooms();
    };
    const onSeen = (data: { roomId: string; userId: string; readAt: string }) => {
      if (roomId && data.roomId === roomId) {
        setReadBy((prev) => ({ ...prev, [data.userId]: data.readAt }));
      }
    };
    const onRoomCreated = () => void loadRooms();
    const onPresenceList = (data: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(data.onlineUserIds));
    };
    const onPresenceUpdate = (data: { userId: string; online: boolean }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (data.online) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    };
    const onTyping = (data: {
      roomId: string;
      userId: string;
      nickname: string;
      isTyping: boolean;
    }) => {
      if (!roomId || data.roomId !== roomId || data.userId === user?.id) return;
      if (typingTimersRef.current[data.userId]) {
        clearTimeout(typingTimersRef.current[data.userId]);
        delete typingTimersRef.current[data.userId];
      }
      if (data.isTyping) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: data.nickname }));
        typingTimersRef.current[data.userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[data.userId];
            return next;
          });
        }, 3500);
      } else {
        setTypingUsers((prev) => {
          if (!(data.userId in prev)) return prev;
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }
    };

    const onReaction = (data: {
      roomId: string;
      messageId: string;
      reactions: Array<{ emoji: string; userId: string }>;
    }) => {
      if (!roomId || data.roomId !== roomId) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:seen', onSeen);
    socket.on('chat:room_created', onRoomCreated);
    socket.on('chat:room_updated', onRoomCreated);
    socket.on('social:updated', onRoomCreated);
    socket.on('presence:list', onPresenceList);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('chat:typing', onTyping);
    socket.on('chat:reaction', onReaction);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:seen', onSeen);
      socket.off('chat:room_created', onRoomCreated);
      socket.off('chat:room_updated', onRoomCreated);
      socket.off('social:updated', onRoomCreated);
      socket.off('presence:list', onPresenceList);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('chat:typing', onTyping);
      socket.off('chat:reaction', onReaction);
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
      setTypingUsers({});
      setReplyingTo(null);
      setReactPickerMsgId(null);
    };
  }, [roomId, loadRooms, user?.id]);

  const openGroupModal = async () => {
    setGroupModalOpen(true);
    setGroupError(null);
    setGroupName('');
    setGroupDescription('');
    setGroupAvatar(GROUP_PRESET_AVATARS[0]);
    setSelectedMembers(new Set());
    try {
      const res = await apiRequest<{ travellers: HostelTraveller[] }>('/traveller/discover');
      setHostelTravellers(res.travellers);
    } catch {
      setHostelTravellers([]);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.size === 0) {
      setGroupError('Select at least 1 traveller to create a group.');
      return;
    }
    setCreatingGroup(true);
    setGroupError(null);
    try {
      const res = await apiRequest<{ roomId: string }>('/chat/rooms/group', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          avatar: groupAvatar,
          memberIds: [...selectedMembers],
        }),
      });
      setGroupModalOpen(false);
      await loadRooms();
      navigate(`/app/chat/${res.roomId}`);
    } catch (err) {
      setGroupError(err instanceof ApiError ? err.message : 'Could not create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (!roomId) return;
    const socket = getSocket();
    const now = Date.now();
    if (val.trim()) {
      if (now - lastTypingSentRef.current > 1400) {
        lastTypingSentRef.current = now;
        socket.emit('chat:typing', { roomId, isTyping: true });
      }
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = setTimeout(() => {
        socket.emit('chat:typing', { roomId, isTyping: false });
        lastTypingSentRef.current = 0;
      }, 2000);
    } else {
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      socket.emit('chat:typing', { roomId, isTyping: false });
      lastTypingSentRef.current = 0;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !text.trim() || sending) return;
    const body = text.trim();
    const replyToId = replyingTo?._id;
    setText('');
    setReplyingTo(null);
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    getSocket().emit('chat:typing', { roomId, isTyping: false });
    lastTypingSentRef.current = 0;
    setSending(true);
    try {
      const res = await apiRequest<{ message: ChatMessageItem }>(
        `/chat/rooms/${roomId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ text: body, ...(replyToId ? { replyToId } : {}) }),
        }
      );
      setMessages((prev) =>
        prev.some((m) => m._id === res.message._id) ? prev : [...prev, res.message]
      );
      void loadRooms();
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!roomId) return;
    setReactPickerMsgId(null);
    const res = await apiRequest<{ reactions: Array<{ emoji: string; userId: string }> }>(
      `/chat/rooms/${roomId}/messages/${messageId}/react`,
      {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }
    );
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, reactions: res.reactions } : m))
    );
  };

  const openMembersModal = async () => {
    setMembersModalOpen(true);
    setEditingGroup(false);
    const current = rooms.find((r) => r._id === roomId);
    if (current) {
      setEditGroupName(current.name);
      setEditGroupDesc(current.description ?? '');
      setEditGroupAvatar(current.avatar);
    }
    try {
      const res = await apiRequest<{ travellers: HostelTraveller[] }>('/traveller/discover');
      setHostelTravellers(res.travellers);
    } catch {
      setHostelTravellers([]);
    }
  };

  const handleSaveGroupDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !editGroupName.trim()) return;
    setSavingGroup(true);
    try {
      await apiRequest(`/chat/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editGroupName.trim(),
          description: editGroupDesc.trim(),
          avatar: editGroupAvatar,
        }),
      });
      setEditingGroup(false);
      await loadRooms();
    } finally {
      setSavingGroup(false);
    }
  };

  const addGroupMember = async (targetUserId: string) => {
    if (!roomId) return;
    setMemberActionId(`add:${targetUserId}`);
    try {
      await apiRequest(`/chat/rooms/${roomId}/members`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      await loadRooms();
    } finally {
      setMemberActionId(null);
    }
  };

  const removeGroupMember = async (targetUserId: string) => {
    if (!roomId) return;
    setMemberActionId(`rm:${targetUserId}`);
    try {
      await apiRequest(`/chat/rooms/${roomId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      if (targetUserId === user?.id) {
        setMembersModalOpen(false);
        await loadRooms();
        navigate('/app/chat');
      } else {
        await loadRooms();
      }
    } finally {
      setMemberActionId(null);
    }
  };

  const openProfile = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === user?.id) return;
    setProfileOpen(true);
    setLoadingProfile(true);
    setProfileData(null);
    setConfirmBlock(false);
    try {
      const res = await apiRequest<{ profile: TravellerProfile }>(
        `/traveller/profile/${targetUserId}`
      );
      setProfileData(res.profile);
    } catch {
      setProfileData(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    setProfileBusy(true);
    setStartingChatId(targetUserId);
    try {
      const res = await apiRequest<{ roomId: string }>('/chat/rooms/direct', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      setProfileOpen(false);
      setMembersModalOpen(false);
      await loadRooms();
      navigate(`/app/chat/${res.roomId}`);
    } finally {
      setProfileBusy(false);
      setStartingChatId(null);
    }
  };

  const blockFromProfile = async (targetUserId: string) => {
    setProfileBusy(true);
    try {
      await apiRequest(`/traveller/block/${targetUserId}`, { method: 'POST' });
      setProfileOpen(false);
      setConfirmBlock(false);
      await loadRooms();
      navigate('/app/chat');
    } finally {
      setProfileBusy(false);
    }
  };

  const activeRoom = rooms.find((r) => r._id === roomId);
  const directOtherMember =
    activeRoom?.type === 'DIRECT'
      ? activeRoom.members.find((m) => m.userId !== user?.id) ?? null
      : null;
  const isOtherOnline = Boolean(
    directOtherMember && onlineUserIds.has(directOtherMember.userId)
  );
  const groupOnlineCount =
    activeRoom?.type === 'GROUP'
      ? activeRoom.members.filter((m) => onlineUserIds.has(m.userId)).length
      : 0;

  // Conversation Thread View (Instagram-style fixed visualViewport; header stays pinned even with mobile keyboard)
  if (roomId) {
    return (
      <div
        style={viewportStyle}
        className="fixed left-0 right-0 top-0 h-[100dvh] z-40 bg-[#f9f9ff] flex justify-center overflow-hidden"
      >
        <div className="w-full max-w-2xl h-full sm:my-3 sm:h-[calc(100%-1.5rem)] flex flex-col bg-white sm:rounded-2xl sm:border sm:border-[#e0bfb8]/35 sm:shadow-sm overflow-hidden">
          {/* Pinned Thread Header */}
          <div className="shrink-0 px-4 py-3 border-b border-[#e0bfb8]/30 bg-[#f9f9ff] flex items-center gap-3">
            <button
              onClick={() => navigate('/app/chat')}
              className="p-1.5 rounded-full hover:bg-[#f0f3ff] text-[#111c2d] shrink-0"
              aria-label="Back to chats"
            >
              <ArrowLeft weight="bold" className="w-4 h-4" />
            </button>
            {activeRoom?.type === 'GROUP' ? (
              <>
                <button
                  type="button"
                  onClick={openMembersModal}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-xl py-0.5 pr-2 hover:bg-[#f0f3ff]/80 transition"
                >
                  {activeRoom.avatar ? (
                    <Avatar
                      src={activeRoom.avatar}
                      name={activeRoom.name}
                      className="w-9 h-9 rounded-xl shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-[#14241E] text-emerald-300 flex items-center justify-center shrink-0">
                      <UsersThree weight="duotone" className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-extrabold text-[#111c2d] truncate">
                      {activeRoom.name}
                    </h2>
                    <p className="text-[11px] text-[#59413c] truncate flex items-center gap-1.5">
                      {Object.values(typingUsers).length > 0 ? (
                        <span className="text-emerald-600 font-extrabold animate-pulse">
                          {Object.values(typingUsers)[0]} is typing...
                        </span>
                      ) : (
                        <>
                          {groupOnlineCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {groupOnlineCount} online
                            </span>
                          )}
                          {groupOnlineCount > 0 && <span>·</span>}
                          <span>{activeRoom.members.length} members</span>
                        </>
                      )}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={openMembersModal}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#14241E] text-[11px] font-bold shrink-0"
                >
                  <UsersThree weight="duotone" className="w-3.5 h-3.5" />
                  Info
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => directOtherMember && openProfile(directOtherMember.userId)}
                disabled={!directOtherMember}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-xl py-0.5 pr-2 hover:bg-[#f0f3ff]/80 transition disabled:hover:bg-transparent"
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={activeRoom?.avatar}
                    name={activeRoom?.name ?? 'Chat'}
                    className="w-9 h-9 rounded-xl"
                  />
                  {isOtherOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#f9f9ff]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-extrabold text-[#111c2d] truncate">
                    {activeRoom?.name ?? 'Hostel Chat'}
                  </h2>
                  <p className="text-[11px] truncate flex items-center gap-1">
                    {Object.values(typingUsers).length > 0 ? (
                      <span className="text-emerald-600 font-extrabold animate-pulse">
                        typing...
                      </span>
                    ) : isOtherOnline ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        <span className="text-emerald-600 font-bold">Online</span>
                        <span className="text-[#59413c]">· Tap for profile</span>
                      </>
                    ) : (
                      <span className="text-[#59413c]">Offline · Tap for profile</span>
                    )}
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Messages (scrolls ONLY inside this box) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 bg-[#f9f9ff]/60">
            {loadingMsgs ? (
              <div className="py-10 flex justify-center text-slate-400">
                <CircleNotch className="w-5 h-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#59413c]">
                Say hi! Messages stay inside your hostel space.
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === user?.id;
                const msgTime = new Date(m.createdAt).getTime();
                const isSeen =
                  mine &&
                  Object.values(readBy).some((ts) => new Date(ts).getTime() >= msgTime);

                const reactionMap = new Map<string, { count: number; byMe: boolean }>();
                for (const r of m.reactions ?? []) {
                  const prev = reactionMap.get(r.emoji) ?? { count: 0, byMe: false };
                  reactionMap.set(r.emoji, {
                    count: prev.count + 1,
                    byMe: prev.byMe || r.userId === user?.id,
                  });
                }
                const groupedReactions = [...reactionMap.entries()];
                const showPicker = reactPickerMsgId === m._id;

                return (
                  <div
                    key={m._id}
                    id={`msg-${m._id}`}
                    className={`group relative flex items-end gap-2 ${
                      mine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!mine && (
                      <button
                        type="button"
                        onClick={() => openProfile(m.senderId)}
                        className="shrink-0 rounded-full hover:opacity-85 active:scale-95 transition"
                        aria-label={`View ${m.senderNickname}'s profile`}
                      >
                        <Avatar
                          src={m.senderAvatar}
                          name={m.senderNickname}
                          className="w-7 h-7 rounded-full"
                        />
                      </button>
                    )}

                    {/* Action Icons (Left side for own messages) */}
                    {mine && (
                      <div className="flex items-center gap-0.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0 pb-1">
                        <button
                          type="button"
                          onClick={() => setReactPickerMsgId(showPicker ? null : m._id)}
                          className="p-1 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-[#111c2d]"
                          aria-label="React to message"
                          title="React"
                        >
                          <Smiley weight="duotone" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(m);
                            setReactPickerMsgId(null);
                            inputRef.current?.focus();
                          }}
                          className="p-1 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-[#111c2d]"
                          aria-label="Reply to message"
                          title="Reply"
                        >
                          <ArrowBendUpLeft weight="bold" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className={`max-w-[75%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {/* Floating Emoji Reaction Picker */}
                      {showPicker && (
                        <div className="mb-1.5 px-2 py-1 rounded-full bg-white border border-[#e0bfb8]/50 shadow-md flex items-center gap-1 z-20">
                          {REACTION_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => void toggleReaction(m._id, em)}
                              className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] active:scale-125 transition text-base flex items-center justify-center"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        className={`w-full px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                          mine
                            ? 'bg-[#14241E] text-white rounded-br-sm'
                            : 'bg-white border border-[#e0bfb8]/35 text-[#111c2d] rounded-bl-sm shadow-2xs'
                        }`}
                      >
                        {!mine && activeRoom?.type === 'GROUP' && (
                          <button
                            type="button"
                            onClick={() => openProfile(m.senderId)}
                            className="block text-[10px] font-bold text-[#a93017] hover:underline mb-0.5 text-left"
                          >
                            {m.senderNickname}
                          </button>
                        )}

                        {m.replyTo && (
                          <button
                            type="button"
                            onClick={() => {
                              document
                                .getElementById(`msg-${m.replyTo!.messageId}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className={`w-full text-left mb-1.5 pl-2.5 pr-2 py-1 rounded-lg border-l-2 text-[11px] ${
                              mine
                                ? 'bg-white/10 border-emerald-400 text-emerald-100'
                                : 'bg-[#f0f3ff] border-[#a93017] text-[#59413c]'
                            }`}
                          >
                            <p className="font-extrabold text-[10px] truncate">
                              {m.replyTo.senderNickname}
                            </p>
                            <p className="truncate opacity-85">{m.replyTo.text}</p>
                          </button>
                        )}

                        <p className="break-words">{m.text}</p>
                        <div
                          className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                            mine ? 'text-emerald-200/70' : 'text-slate-400'
                          }`}
                        >
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {mine &&
                            (isSeen ? (
                              <span className="font-semibold text-emerald-300">· Seen</span>
                            ) : (
                              <span className="text-emerald-200/50">· Sent</span>
                            ))}
                        </div>
                      </div>

                      {/* Reaction Pills */}
                      {groupedReactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {groupedReactions.map(([em, info]) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => void toggleReaction(m._id, em)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition active:scale-95 ${
                                info.byMe
                                  ? 'bg-[#ffdad3]/60 border-[#a93017]/40 text-[#a93017]'
                                  : 'bg-white border-[#e0bfb8]/40 text-[#111c2d]'
                              }`}
                            >
                              <span>{em}</span>
                              {info.count > 1 && <span>{info.count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Icons (Right side for received messages) */}
                    {!mine && (
                      <div className="flex items-center gap-0.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0 pb-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(m);
                            setReactPickerMsgId(null);
                            inputRef.current?.focus();
                          }}
                          className="p-1 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-[#111c2d]"
                          aria-label="Reply to message"
                          title="Reply"
                        >
                          <ArrowBendUpLeft weight="bold" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReactPickerMsgId(showPicker ? null : m._id)}
                          className="p-1 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-[#111c2d]"
                          aria-label="React to message"
                          title="React"
                        >
                          <Smiley weight="duotone" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {Object.values(typingUsers).length > 0 && (
              <div className="flex items-end gap-2 justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-[#e0bfb8]/35 shadow-2xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14241E]/60 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14241E]/60 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14241E]/60 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Preview Banner */}
          {replyingTo && (
            <div className="shrink-0 px-4 py-2 bg-[#f0f3ff] border-t border-[#e0bfb8]/30 flex items-center justify-between gap-2">
              <div className="min-w-0 border-l-2 border-[#a93017] pl-2.5">
                <p className="text-[10px] font-extrabold text-[#a93017] truncate">
                  Replying to {replyingTo.senderId === user?.id ? 'yourself' : replyingTo.senderNickname}
                </p>
                <p className="text-xs text-[#59413c] truncate">{replyingTo.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-white hover:text-[#111c2d] shrink-0"
                aria-label="Cancel reply"
              >
                <X weight="bold" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pinned Input Bar */}
          <form
            onSubmit={handleSend}
            className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#e0bfb8]/30 bg-white flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={replyingTo ? 'Write a reply...' : 'Write a message...'}
              maxLength={500}
              className="flex-1 px-4 py-2.5 rounded-full bg-[#f0f3ff] text-[16px] sm:text-xs text-[#111c2d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a93017]/20"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="w-10 h-10 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white flex items-center justify-center shrink-0 transition active:scale-95 disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? (
                <CircleNotch className="w-4 h-4 animate-spin" />
              ) : (
                <PaperPlaneTilt weight="fill" className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>

        {/* Group Details & Members Modal */}
        {membersModalOpen && activeRoom?.type === 'GROUP' && (
          <div
            className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setMembersModalOpen(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#111c2d] text-base">
                  Group Info
                </h3>
                <button
                  type="button"
                  onClick={() => setMembersModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>

              {!editingGroup ? (
                <div className="flex flex-col items-center text-center gap-2 pb-3 border-b border-slate-100">
                  {activeRoom.avatar ? (
                    <Avatar
                      src={activeRoom.avatar}
                      name={activeRoom.name}
                      className="w-16 h-16 rounded-2xl shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[#14241E] text-emerald-300 flex items-center justify-center shadow-sm">
                      <UsersThree weight="duotone" className="w-8 h-8" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-extrabold text-[#111c2d]">
                      {activeRoom.name}
                    </h4>
                    <p className="text-xs text-[#59413c] mt-0.5">
                      {activeRoom.description || 'Hostel group chat · Tap Edit to add details'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditGroupName(activeRoom.name);
                      setEditGroupDesc(activeRoom.description ?? '');
                      setEditGroupAvatar(activeRoom.avatar);
                      setEditingGroup(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#14241E] text-[11px] font-bold"
                  >
                    <PencilSimple weight="bold" className="w-3 h-3" />
                    Edit Avatar &amp; Details
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveGroupDetails}
                  className="space-y-3 pb-3 border-b border-slate-100"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-[#59413c] uppercase tracking-wider mb-1.5">
                      Group Avatar
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {GROUP_PRESET_AVATARS.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setEditGroupAvatar(url)}
                          className={`p-1 rounded-xl border-2 transition flex items-center justify-center ${
                            editGroupAvatar === url
                              ? 'border-[#a93017] bg-[#a93017]/5'
                              : 'border-transparent hover:border-[#e0bfb8]/60 bg-[#f9f9ff]'
                          }`}
                        >
                          <Avatar src={url} name="Group avatar" className="w-12 h-12 rounded-xl" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111c2d] mb-1">
                      Group Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={60}
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111c2d] mb-1">
                      Group Details
                    </label>
                    <textarea
                      rows={2}
                      maxLength={200}
                      value={editGroupDesc}
                      onChange={(e) => setEditGroupDesc(e.target.value)}
                      placeholder="What is this group about?"
                      className="w-full px-3 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d] resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingGroup(false)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingGroup}
                      className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold disabled:opacity-60"
                    >
                      {savingGroup && <CircleNotch className="w-3 h-3 animate-spin" />}
                      Save
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[#59413c] uppercase tracking-wider">
                  Members ({activeRoom.members.length})
                </p>
                {activeRoom.members.map((m) => {
                  const isMe = m.userId === user?.id;
                  const isCreator = activeRoom.createdBy === user?.id;
                  const isMemberCreator = activeRoom.createdBy === m.userId;
                  return (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#f0f3ff] text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => !isMe && openProfile(m.userId)}
                        disabled={isMe}
                        className="flex items-center gap-2 min-w-0 text-left hover:opacity-85 disabled:hover:opacity-100"
                      >
                        <div className="relative shrink-0">
                          <Avatar src={m.avatar} name={m.nickname} className="w-7 h-7 rounded-full" />
                          {onlineUserIds.has(m.userId) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#f0f3ff]" />
                          )}
                        </div>
                        <span className="font-bold text-[#111c2d] truncate">
                          {m.nickname} {isMe ? '(You)' : ''}
                        </span>
                        {isMemberCreator && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#14241E] text-emerald-300 text-[9px] font-bold shrink-0">
                            Admin
                          </span>
                        )}
                      </button>
                      {isCreator && !isMe && (
                        <button
                          type="button"
                          onClick={() => removeGroupMember(m.userId)}
                          disabled={memberActionId !== null}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] disabled:opacity-60"
                        >
                          {memberActionId === `rm:${m.userId}` ? (
                            <CircleNotch className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserMinus weight="duotone" className="w-3.5 h-3.5" />
                          )}
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Other Hostel Travellers */}
              {hostelTravellers.filter(
                (t) => !activeRoom.members.some((m) => m.userId === t.userId)
              ).length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] font-bold text-[#59413c] uppercase tracking-wider">
                    Add to Group
                  </p>
                  {hostelTravellers
                    .filter((t) => !activeRoom.members.some((m) => m.userId === t.userId))
                    .map((t) => (
                      <div
                        key={t.userId}
                        className="flex items-center justify-between p-2 rounded-xl border border-[#e0bfb8]/35 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar src={t.avatar} name={t.nickname} className="w-7 h-7 rounded-full" />
                          <span className="font-bold text-[#111c2d]">{t.nickname}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addGroupMember(t.userId)}
                          disabled={memberActionId !== null}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#14241E] text-emerald-300 font-bold text-[11px] disabled:opacity-60"
                        >
                          {memberActionId === `add:${t.userId}` ? (
                            <CircleNotch className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus weight="duotone" className="w-3.5 h-3.5" />
                          )}
                          Add
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {user?.id && (
                <button
                  type="button"
                  onClick={() => removeGroupMember(user.id)}
                  disabled={memberActionId !== null}
                  className="w-full py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {memberActionId === `rm:${user.id}` ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <SignOut weight="duotone" className="w-4 h-4" />
                  )}
                  Leave Group
                </button>
              )}
            </div>
          </div>
        )}

        {/* Traveller Profile Modal */}
        {profileOpen && (
          <div
            className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setProfileOpen(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#111c2d] text-base">
                  Traveller Profile
                </h3>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>

              {loadingProfile ? (
                <div className="py-10 flex justify-center text-slate-400">
                  <CircleNotch className="w-6 h-6 animate-spin" />
                </div>
              ) : !profileData ? (
                <p className="text-xs text-[#59413c] text-center py-6">
                  Could not load profile right now.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Avatar & Vibe */}
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="relative">
                      <Avatar
                        src={profileData.avatar}
                        name={profileData.nickname}
                        className="w-20 h-20 rounded-2xl shadow-sm"
                      />
                      {(profileData.isOnline || onlineUserIds.has(profileData.userId)) && (
                        <span
                          title="Online"
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1.5">
                        <h4 className="text-lg font-extrabold text-[#111c2d]">
                          {profileData.nickname}
                        </h4>
                        {(profileData.isOnline || onlineUserIds.has(profileData.userId)) && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Online
                          </span>
                        )}
                      </div>
                      {profileData.socialStatus ? (
                        <span className="mt-1 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#14241E] text-emerald-300 text-[11px] font-bold">
                          <Sparkle weight="fill" className="w-3 h-3" />
                          {VIBE_LABELS[profileData.socialStatus] ?? profileData.socialStatus}
                        </span>
                      ) : (
                        <span className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">
                          Staying at your hostel
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Interests */}
                  {profileData.interests.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-[#59413c] uppercase tracking-wider">
                        Interests
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {profileData.interests.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-1 rounded-full bg-[#f0f3ff] text-[#111c2d] text-xs font-semibold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Hosted Activities */}
                  {profileData.hostedActivities.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-[#59413c] uppercase tracking-wider">
                        Hosting Soon
                      </p>
                      <div className="space-y-1.5">
                        {profileData.hostedActivities.map((act) => (
                          <button
                            key={act._id}
                            type="button"
                            onClick={() => {
                              setProfileOpen(false);
                              navigate(`/app/activities/${act._id}`);
                            }}
                            className="w-full text-left p-2.5 rounded-xl bg-[#f9f9ff] hover:bg-[#f0f3ff] border border-[#e0bfb8]/30 transition"
                          >
                            <p className="text-xs font-bold text-[#111c2d] truncate">
                              {act.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#59413c]">
                              <span className="inline-flex items-center gap-0.5">
                                <CalendarBlank weight="duotone" className="w-3 h-3 text-[#a93017]" />
                                {new Date(act.startTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <MapPin weight="duotone" className="w-3 h-3 text-[#a93017]" />
                                {act.meetingPoint}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    {activeRoom?.type === 'GROUP' && (
                      <button
                        type="button"
                        disabled={profileBusy}
                        onClick={() => startDirectChat(profileData.userId)}
                        className="w-full py-2.5 rounded-full bg-[#14241E] hover:bg-emerald-950 text-emerald-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {profileBusy ? (
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ChatCircleDots weight="duotone" className="w-4 h-4" />
                        )}
                        Message {profileData.nickname}
                      </button>
                    )}

                    {!confirmBlock ? (
                      <button
                        type="button"
                        onClick={() => setConfirmBlock(true)}
                        className="w-full py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <Prohibit weight="duotone" className="w-3.5 h-3.5" />
                        Block {profileData.nickname}
                      </button>
                    ) : (
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                        <p className="text-[11px] font-semibold text-rose-800 text-center">
                          Block {profileData.nickname}? You won&apos;t see each other in Discover or Chat.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmBlock(false)}
                            className="flex-1 py-1.5 rounded-full bg-white text-slate-600 text-xs font-bold border border-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={profileBusy}
                            onClick={() => blockFromProfile(profileData.userId)}
                            className="flex-1 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-60"
                          >
                            {profileBusy && <CircleNotch className="w-3 h-3 animate-spin" />}
                            Confirm Block
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const directPeerIds = new Set(
    rooms
      .filter((r) => r.type === 'DIRECT')
      .flatMap((r) => r.members.map((m) => m.userId))
      .filter((id) => id !== user?.id)
  );
  const unchattedPeople = hostelTravellers.filter((t) => !directPeerIds.has(t.userId));

  // Room List View
  return (
    <TravellerLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-extrabold text-[#111c2d] tracking-tight">Hostel Chat</h1>
            <p className="text-xs text-[#59413c]">Direct messages &amp; group plans</p>
          </div>
          <button
            type="button"
            onClick={openGroupModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#14241E] hover:bg-emerald-950 text-emerald-300 text-xs font-bold shadow-xs transition active:scale-95"
          >
            <Plus weight="bold" className="w-3.5 h-3.5" /> New Group
          </button>
        </div>

        {loadingRooms ? (
          <div className="py-12 flex justify-center text-slate-400">
            <CircleNotch className="w-6 h-6 animate-spin" />
          </div>
        ) : rooms.length === 0 && unchattedPeople.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#f0f3ff] text-[#14241E] flex items-center justify-center mx-auto mb-3">
              <ChatCircleDots weight="duotone" className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#111c2d]">No chats yet</p>
            <p className="text-xs text-[#59413c] mt-1 mb-4">
              Tap Chat on any traveller in Discover, or create a group chat for your outing!
            </p>
            <button
              onClick={openGroupModal}
              className="px-5 py-2.5 rounded-full bg-[#a93017] text-white text-xs font-bold shadow-xs"
            >
              Create a Group Chat
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {rooms.length > 0 && (
              <div className="space-y-2.5">
                {rooms.map((room) => {
                  const roomHasOnline = room.members.some(
                    (m) => m.userId !== user?.id && onlineUserIds.has(m.userId)
                  );
                  return (
                    <button
                      key={room._id}
                      type="button"
                      onClick={() => navigate(`/app/chat/${room._id}`)}
                      className="w-full text-left bg-white rounded-2xl border border-[#e0bfb8]/35 p-3.5 shadow-2xs hover:shadow-sm transition flex items-center gap-3 active:scale-[0.99]"
                    >
                      <div className="relative shrink-0">
                        {room.type === 'GROUP' && !room.avatar ? (
                          <div className="w-11 h-11 rounded-2xl bg-[#14241E] text-emerald-300 flex items-center justify-center">
                            <UsersThree weight="duotone" className="w-6 h-6" />
                          </div>
                        ) : (
                          <Avatar src={room.avatar} name={room.name} className="w-11 h-11 rounded-2xl" />
                        )}
                        {roomHasOnline && (
                          <span
                            title="Online"
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-[#111c2d] truncate">{room.name}</p>
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            {new Date(room.lastMessageAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-[#59413c] truncate">
                            {room.lastMessageText || 'Tap to start chatting'}
                          </p>
                          {(room.unreadCount ?? 0) > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#a93017] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                              {room.unreadCount! > 99 ? '99+' : room.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {unchattedPeople.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#59413c]">
                    People Here · Say Hi ({unchattedPeople.length})
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {unchattedPeople.map((t) => {
                    const isOnline = Boolean(t.isOnline || onlineUserIds.has(t.userId));
                    const starting = startingChatId === t.userId;
                    return (
                      <button
                        key={t.userId}
                        type="button"
                        disabled={startingChatId !== null}
                        onClick={() => startDirectChat(t.userId)}
                        className="w-full text-left bg-white rounded-2xl border border-[#e0bfb8]/35 p-3.5 shadow-2xs hover:shadow-sm transition flex items-center justify-between gap-3 active:scale-[0.99] disabled:opacity-70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <Avatar
                              src={t.avatar}
                              name={t.nickname}
                              className="w-11 h-11 rounded-2xl"
                            />
                            {isOnline && (
                              <span
                                title="Online"
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-extrabold text-[#111c2d] truncate">
                                {t.nickname}
                              </p>
                              {isOnline && (
                                <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                                  Online
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#59413c] truncate">
                              Tap to start chatting
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f0f3ff] text-[#14241E] text-[11px] font-bold">
                          {starting ? (
                            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ChatCircleDots weight="duotone" className="w-3.5 h-3.5 text-[#a93017]" />
                          )}
                          {starting ? 'Opening...' : 'Chat'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* New Group Chat Modal */}
        {groupModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateGroup}
              className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35 max-h-[88vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#111c2d] text-base">Create Group Chat</h3>
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>

              {groupError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {groupError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                  Choose Group Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {GROUP_PRESET_AVATARS.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setGroupAvatar(url)}
                      className={`p-1 rounded-xl border-2 transition flex items-center justify-center ${
                        groupAvatar === url
                          ? 'border-[#a93017] bg-[#a93017]/5'
                          : 'border-transparent hover:border-[#e0bfb8]/60 bg-[#f9f9ff]'
                      }`}
                    >
                      <Avatar src={url} name="Group avatar" className="w-12 h-12 rounded-xl" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Sunset Fort Crew"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1">
                  Group Details (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={200}
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="e.g., Sunset hike & rooftop chai plans"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                  Add Travellers ({selectedMembers.size} selected)
                </label>
                {hostelTravellers.length === 0 ? (
                  <p className="text-xs text-[#59413c]">No other travellers active right now.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {hostelTravellers.map((t) => {
                      const picked = selectedMembers.has(t.userId);
                      return (
                        <button
                          key={t.userId}
                          type="button"
                          onClick={() => toggleMember(t.userId)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition ${
                            picked
                              ? 'bg-[#14241E] text-white border-[#14241E]'
                              : 'bg-[#f0f3ff] text-[#111c2d] border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar src={t.avatar} name={t.nickname} className="w-7 h-7 rounded-full" />
                            <span>{t.nickname}</span>
                          </div>
                          {picked && <Check weight="bold" className="w-4 h-4 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-[#a93017] hover:bg-[#cb482c] text-white shadow-xs disabled:opacity-60"
                >
                  {creatingGroup && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
