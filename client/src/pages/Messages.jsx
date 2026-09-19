import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function Messages() {
  const { user, token, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');

  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [sending, setSending] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);

  // Keep selectedUserRef synchronized for socket callbacks
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper to re-sort conversations by latest message timestamp
  const sortConversations = (list) => {
    return [...list].sort((a, b) => {
      const timeA = a.latest_message_time || a.last_message_at ? new Date(a.latest_message_time || a.last_message_at).getTime() : 0;
      const timeB = b.latest_message_time || b.last_message_at ? new Date(b.latest_message_time || b.last_message_at).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    const currentToken = token || localStorage.getItem('token');
    if (!currentToken || !user) return;

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
        : 'http://localhost:5001');

    const socket = io(socketUrl, {
      auth: {
        token: currentToken
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Socket connected
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    socket.on('receive_message', (msg) => {
      // Update message list if relevant to active conversation
      const currentSelected = selectedUserRef.current;
      if (
        currentSelected &&
        (msg.sender_id === currentSelected.id ||
          (msg.sender_id === user.id && msg.receiver_id === currentSelected.id))
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      // Update conversation list preview and re-sort
      setConversations((prev) => {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const exists = prev.some((c) => c.id === otherUserId);
        if (!exists) return prev;

        const updated = prev.map((c) => {
          if (c.id === otherUserId) {
            return {
              ...c,
              latest_message: msg.message,
              latest_message_time: msg.created_at,
              last_message: msg.message,
              last_message_at: msg.created_at
            };
          }
          return c;
        });

        return sortConversations(updated);
      });
    });

    return () => {
      socket.off('receive_message');
      socket.off('connect_error');
      socket.off('connect');
      socket.disconnect();
    };
  }, [user, token]);

  // Fetch conversations list
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      try {
        setLoadingConversations(true);
        setError(null);
        const res = await api.get('/messages/conversations');
        if (res.data.success) {
          const list = res.data.conversations || [];
          const sortedList = sortConversations(list);
          setConversations(sortedList);

          // If targetUserId specified in query param, select that user, else select first
          if (sortedList.length > 0) {
            if (targetUserId) {
              const matched = sortedList.find((c) => String(c.id) === String(targetUserId));
              setSelectedUser(matched || sortedList[0]);
            } else {
              setSelectedUser((prev) => {
                if (prev) {
                  const updatedPrev = sortedList.find((c) => c.id === prev.id);
                  return updatedPrev || sortedList[0];
                }
                return sortedList[0];
              });
            }
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load conversations.');
      } finally {
        setLoadingConversations(false);
      }
    };

    if (!authLoading && user) {
      fetchConversations();
    }
  }, [user, authLoading, targetUserId]);

  // Fetch message history when selectedUser changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedUser) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        setSendError(null);
        const res = await api.get(`/messages/${selectedUser.id}`);
        if (res.data.success) {
          setMessages(res.data.messages || []);
        }
      } catch (err) {
        setSendError(err.response?.data?.message || err.message || 'Failed to load message history.');
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedUser]);

  // Handle Send Message
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !selectedUser) return;

    if (trimmed.length > 1000) {
      setSendError('Message cannot exceed 1000 characters.');
      return;
    }

    setSendError(null);
    setSending(true);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(
        'send_message',
        { receiverId: selectedUser.id, message: trimmed },
        (response) => {
          setSending(false);
          if (response && response.success) {
            setInputText('');
            // Add message to state if not already received via event
            const savedMsg = response.message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === savedMsg.id)) return prev;
              return [...prev, savedMsg];
            });
            // Update conversation list preview and re-sort
            setConversations((prev) => {
              const updated = prev.map((c) =>
                c.id === selectedUser.id
                  ? {
                      ...c,
                      latest_message: savedMsg.message,
                      latest_message_time: savedMsg.created_at,
                      last_message: savedMsg.message,
                      last_message_at: savedMsg.created_at
                    }
                  : c
              );
              return sortConversations(updated);
            });
          } else {
            setSendError(response?.message || 'Failed to deliver message.');
          }
        }
      );
    } else {
      setSendError('Connection lost. Please check your network and try again.');
      setSending(false);
    }
  };

  // Format timestamp helper
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <p className="status-value status-checking">Loading messaging workspace...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">Please log in to access your messages.</p>
          <Link to="/" className="submit-btn" style={{ display: 'inline-block', width: 'auto' }}>
            Back to Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">
            Direct communication between candidates and recruiters with active applications.
          </p>
        </div>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      <div className="chat-container card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Left Column: Conversations Sidebar */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Conversations
            </h3>
          </div>

          <div className="chat-conversations-list">
            {loadingConversations ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <p className="status-value status-checking">Loading contacts...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  No conversations available yet.
                </p>
                <p style={{ fontSize: '0.85rem' }}>
                  {user.role === 'candidate'
                    ? 'Apply to job openings to start conversations with recruiters.'
                    : 'Candidates who apply to your job listings will appear here.'}
                </p>
              </div>
            ) : (
              conversations.map((contact) => {
                const isSelected = selectedUser && selectedUser.id === contact.id;
                const messagePreview = contact.latest_message || contact.last_message;
                const messageTime = contact.latest_message_time || contact.last_message_at;

                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`chat-contact-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedUser(contact)}
                  >
                    <div className="chat-contact-main">
                      <div className="chat-contact-top">
                        <span className="chat-contact-name">{contact.name}</span>
                        {messageTime && (
                          <span className="chat-contact-time">
                            {formatDateLabel(messageTime)}
                          </span>
                        )}
                      </div>
                      <div className="chat-contact-sub">
                        <span className="badge-tag" style={{
                          background: contact.role === 'recruiter' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: contact.role === 'recruiter' ? '#38bdf8' : '#4ade80',
                          padding: '0.1rem 0.45rem',
                          fontSize: '0.7rem'
                        }}>
                          {contact.role}
                        </span>
                        {messagePreview ? (
                          <span className="chat-contact-preview">{messagePreview}</span>
                        ) : (
                          <span className="chat-contact-preview" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                            No messages yet
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Chat Window */}
        <main className="chat-window">
          {selectedUser ? (
            <>
              {/* Chat Window Header */}
              <div className="chat-window-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                      {selectedUser.name}
                    </h2>
                    <span className="badge-tag" style={{
                      background: selectedUser.role === 'recruiter' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      color: selectedUser.role === 'recruiter' ? '#38bdf8' : '#4ade80',
                      textTransform: 'capitalize',
                      fontSize: '0.75rem'
                    }}>
                      {selectedUser.role}
                    </span>
                  </div>
                  {selectedUser.email && (
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {selectedUser.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages List */}
              <div className="chat-messages-area">
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: '#94a3b8' }}>
                    <p className="status-value status-checking">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <p style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.25rem' }}>
                      No messages yet. Start the conversation.
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      Send a message below to coordinate regarding applications and interviews.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user.id;
                    return (
                      <div
                        key={msg.id || `${msg.sender_id}-${msg.created_at}`}
                        className={`message-row ${isMe ? 'message-out' : 'message-in'}`}
                      >
                        <div className="message-bubble">
                          <p className="message-text">{msg.message}</p>
                          <span className="message-timestamp">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Fixed Bottom Composer Area */}
              <div className="chat-composer">
                {sendError && (
                  <div className="alert-message alert-error chat-composer-error">
                    {sendError}
                  </div>
                )}
                <form className="chat-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (sendError) setSendError(null);
                    }}
                    disabled={sending}
                    className="chat-input"
                  />
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={sending || !inputText.trim()}
                    style={{ minWidth: '90px' }}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="chat-empty-state" style={{ margin: 'auto' }}>
              <p style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: 600 }}>
                Select a conversation
              </p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                Choose a contact from the left list to view or start messaging.
              </p>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}

export default Messages;
