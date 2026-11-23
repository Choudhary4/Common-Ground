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
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { Avatar } from '../components/Avatar';
import { apiRequest, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

interface RoomMember {
  userId: string;
  nickname: string;
  avatar: string | null;
}

interface ChatRoomItem {
  _id: string;
  type: 'DIRECT' | 'GROUP';
  name: string;
  avatar: string | null;
  createdBy?: string;
  members: RoomMember[];
  lastMessageText: string;
  lastMessageAt: string;
}

interface ChatMessageItem {
  _id: string;
  roomId: string;
  senderId: string;
  senderNickname: string;
  senderAvatar: string | null;
  text: string;
  createdAt: string;
}

interface HostelTraveller {
  userId: string;
  nickname: string;
  avatar: string | null;
}

export function ChatPage() {
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Create group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [hostelTravellers, setHostelTravellers] = useState<HostelTraveller[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Group members modal
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const res = await apiRequest<{ rooms: ChatRoomItem[] }>('/chat/rooms');
      setRooms(res.rooms);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMsgs(true);
    try {
      const res = await apiRequest<{ messages: ChatMessageItem[] }>(`/chat/rooms/${id}/messages`);
      setMessages(res.messages);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (roomId) {
      void loadMessages(roomId);
    } else {
      setMessages([]);
    }
  }, [roomId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    const onMessage = (msg: ChatMessageItem) => {
      if (roomId && msg.roomId === roomId) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
      void loadRooms();
    };
    const onRoomCreated = () => void loadRooms();

    socket.on('chat:message', onMessage);
    socket.on('chat:room_created', onRoomCreated);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:room_created', onRoomCreated);
    };
  }, [roomId, loadRooms]);

  const openGroupModal = async () => {
    setGroupModalOpen(true);
    setGroupError(null);
    setGroupName('');
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !text.trim() || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await apiRequest<{ message: ChatMessageItem }>(
        `/chat/rooms/${roomId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ text: body }),
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

  const openMembersModal = async () => {
    setMembersModalOpen(true);
    try {
      const res = await apiRequest<{ travellers: HostelTraveller[] }>('/traveller/discover');
      setHostelTravellers(res.travellers);
    } catch {
      setHostelTravellers([]);
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

  const activeRoom = rooms.find((r) => r._id === roomId);

  // Conversation Thread View
  if (roomId) {
    return (
      <TravellerLayout>
        <div className="flex flex-col h-[calc(100vh-11.5rem)] bg-white rounded-2xl border border-[#e0bfb8]/35 shadow-sm overflow-hidden">
          {/* Thread Header */}
          <div className="px-4 py-3 border-b border-[#e0bfb8]/30 bg-[#f9f9ff] flex items-center gap-3">
            <button
              onClick={() => navigate('/app/chat')}
              className="p-1.5 rounded-full hover:bg-[#f0f3ff] text-[#111c2d]"
              aria-label="Back to chats"
            >
              <ArrowLeft weight="bold" className="w-4 h-4" />
            </button>
            {activeRoom?.type === 'GROUP' ? (
              <div className="w-9 h-9 rounded-xl bg-[#14241E] text-emerald-300 flex items-center justify-center shrink-0">
                <UsersThree weight="duotone" className="w-5 h-5" />
              </div>
            ) : (
              <Avatar
                src={activeRoom?.avatar}
                name={activeRoom?.name ?? 'Chat'}
                className="w-9 h-9 rounded-xl"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold text-[#111c2d] truncate">
                {activeRoom?.name ?? 'Hostel Chat'}
              </h2>
              {activeRoom?.type === 'GROUP' && (
                <p className="text-[11px] text-[#59413c] truncate">
                  {activeRoom.members.map((m) => m.nickname).join(', ')}
                </p>
              )}
            </div>
            {activeRoom?.type === 'GROUP' && (
              <button
                type="button"
                onClick={openMembersModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#14241E] text-[11px] font-bold shrink-0"
              >
                <UsersThree weight="duotone" className="w-3.5 h-3.5" />
                Members ({activeRoom.members.length})
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f9f9ff]/60">
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
                return (
                  <div
                    key={m._id}
                    className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!mine && (
                      <Avatar
                        src={m.senderAvatar}
                        name={m.senderNickname}
                        className="w-7 h-7 rounded-full"
                      />
                    )}
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                        mine
                          ? 'bg-[#14241E] text-white rounded-br-sm'
                          : 'bg-white border border-[#e0bfb8]/35 text-[#111c2d] rounded-bl-sm shadow-2xs'
                      }`}
                    >
                      {!mine && activeRoom?.type === 'GROUP' && (
                        <p className="text-[10px] font-bold text-[#a93017] mb-0.5">
                          {m.senderNickname}
                        </p>
                      )}
                      <p className="break-words">{m.text}</p>
                      <p
                        className={`text-[9px] mt-1 text-right ${
                          mine ? 'text-emerald-200/70' : 'text-slate-400'
                        }`}
                      >
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-[#e0bfb8]/30 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message..."
              maxLength={500}
              className="flex-1 px-4 py-2.5 rounded-full bg-[#f0f3ff] text-xs text-[#111c2d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a93017]/20"
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

        {/* Group Members Modal */}
        {membersModalOpen && activeRoom?.type === 'GROUP' && (
          <div className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#111c2d] text-base">
                  {activeRoom.name} · Members
                </h3>
                <button
                  type="button"
                  onClick={() => setMembersModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {activeRoom.members.map((m) => {
                  const isMe = m.userId === user?.id;
                  const isCreator = activeRoom.createdBy === user?.id;
                  const isMemberCreator = activeRoom.createdBy === m.userId;
                  return (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#f0f3ff] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={m.avatar} name={m.nickname} className="w-7 h-7 rounded-full" />
                        <span className="font-bold text-[#111c2d] truncate">
                          {m.nickname} {isMe ? '(You)' : ''}
                        </span>
                        {isMemberCreator && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#14241E] text-emerald-300 text-[9px] font-bold">
                            Admin
                          </span>
                        )}
                      </div>
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
      </TravellerLayout>
    );
  }

  // Room List View
  return (
    <TravellerLayout>
      <div className="space-y-4">
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
        ) : rooms.length === 0 ? (
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
          <div className="space-y-2.5">
            {rooms.map((room) => (
              <button
                key={room._id}
                type="button"
                onClick={() => navigate(`/app/chat/${room._id}`)}
                className="w-full text-left bg-white rounded-2xl border border-[#e0bfb8]/35 p-3.5 shadow-2xs hover:shadow-sm transition flex items-center gap-3 active:scale-[0.99]"
              >
                {room.type === 'GROUP' ? (
                  <div className="w-11 h-11 rounded-2xl bg-[#14241E] text-emerald-300 flex items-center justify-center shrink-0">
                    <UsersThree weight="duotone" className="w-6 h-6" />
                  </div>
                ) : (
                  <Avatar src={room.avatar} name={room.name} className="w-11 h-11 rounded-2xl" />
                )}
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
                  <p className="text-xs text-[#59413c] truncate mt-0.5">
                    {room.lastMessageText || 'Tap to start chatting'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* New Group Chat Modal */}
        {groupModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateGroup}
              className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35"
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
