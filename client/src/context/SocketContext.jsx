// src/context/SocketContext.jsx - Enhanced with private messaging and reactions
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [privateConversations, setPrivateConversations] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [privateTypingUsers, setPrivateTypingUsers] = useState(new Map());
  const [notifications, setNotifications] = useState([]);
  const [activeChat, setActiveChat] = useState('general');

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      autoConnect: false
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('receive_message', (message) => {
      console.log('📨 Received public message:', message);
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('receive_private_message', (message) => {
      console.log('💌 Received private message:', message);
      
      const otherUserId = message.senderId === newSocket.id ? message.recipientId : message.senderId;
      
      setPrivateConversations(prev => {
        const newConversations = new Map(prev);
        const existingMessages = newConversations.get(otherUserId) || [];
        newConversations.set(otherUserId, [...existingMessages, message]);
        return newConversations;
      });

      if (message.senderId !== newSocket.id && activeChat !== message.senderId) {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'private_message',
          senderId: message.senderId,
          senderUsername: message.username,
          content: message.content,
          timestamp: message.timestamp
        }]);
      }
    });

    // All your other existing event handlers...
    newSocket.on('private_message_notification', (notification) => {
      console.log('🔔 Private message notification:', notification);
      
      if (activeChat !== notification.senderId) {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'private_message',
          ...notification
        }]);
      }
    });

    newSocket.on('user_joined', (data) => {
      console.log('👤 User joined:', data);
      const systemMessage = {
        id: Date.now(),
        username: 'System',
        content: data.message,
        timestamp: data.timestamp,
        isSystem: true
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    newSocket.on('user_left', (data) => {
      console.log('👋 User left:', data);
      const systemMessage = {
        id: Date.now(),
        username: 'System',
        content: data.message,
        timestamp: data.timestamp,
        isSystem: true
      };
      setMessages(prev => [...prev, systemMessage]);
    });

    newSocket.on('online_users', (users) => {
      console.log('👥 Online users:', users);
      setOnlineUsers(users);
    });

    newSocket.on('user_list_updated', (users) => {
      console.log('🔄 User list updated:', users);
      setOnlineUsers(users);
    });

    newSocket.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          if (!prev.includes(data.username)) {
            return [...prev, data.username];
          }
          return prev;
        });
      } else {
        setTypingUsers(prev => prev.filter(user => user !== data.username));
      }
    });

    newSocket.on('user_typing_private', (data) => {
      setPrivateTypingUsers(prev => {
        const newTypingUsers = new Map(prev);
        if (data.isTyping) {
          newTypingUsers.set(data.senderId, data.username);
        } else {
          newTypingUsers.delete(data.senderId);
        }
        return newTypingUsers;
      });
    });

    // NEW: Reaction event handlers
    newSocket.on('reaction_added', (reaction) => {
      console.log('👍 Reaction added:', reaction);
      
      if (reaction.messageId) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === reaction.messageId) {
            const reactions = msg.reactions || {};
            const emojiReactions = reactions[reaction.emoji] || [];
            const userAlreadyReacted = emojiReactions.some(r => r.userId === reaction.userId);
            
            if (!userAlreadyReacted) {
              return {
                ...msg,
                reactions: {
                  ...reactions,
                  [reaction.emoji]: [...emojiReactions, reaction]
                }
              };
            }
          }
          return msg;
        }));

        setPrivateConversations(prev => {
          const newConversations = new Map(prev);
          for (let [userId, messages] of newConversations) {
            const updatedMessages = messages.map(msg => {
              if (msg.id === reaction.messageId) {
                const reactions = msg.reactions || {};
                const emojiReactions = reactions[reaction.emoji] || [];
                const userAlreadyReacted = emojiReactions.some(r => r.userId === reaction.userId);
                
                if (!userAlreadyReacted) {
                  return {
                    ...msg,
                    reactions: {
                      ...reactions,
                      [reaction.emoji]: [...emojiReactions, reaction]
                    }
                  };
                }
              }
              return msg;
            });
            newConversations.set(userId, updatedMessages);
          }
          return newConversations;
        });
      }
    });

    newSocket.on('reaction_removed', (data) => {
      console.log('👎 Reaction removed:', data);
      
      const removeReactionFromMessages = (messages) => 
        messages.map(msg => {
          if (msg.id === data.messageId && msg.reactions) {
            const reactions = { ...msg.reactions };
            if (reactions[data.emoji]) {
              reactions[data.emoji] = reactions[data.emoji].filter(r => r.userId !== data.userId);
              if (reactions[data.emoji].length === 0) {
                delete reactions[data.emoji];
              }
            }
            return { ...msg, reactions };
          }
          return msg;
        });

      setMessages(prev => removeReactionFromMessages(prev));
      
      setPrivateConversations(prev => {
        const newConversations = new Map(prev);
        for (let [userId, messages] of newConversations) {
          newConversations.set(userId, removeReactionFromMessages(messages));
        }
        return newConversations;
      });
    });

    newSocket.on('message_error', (error) => {
      console.error('❌ Message error:', error);
      alert(error.error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [activeChat]);

  // All your existing functions...
  const joinChat = (username) => {
    if (socket && username.trim()) {
      setCurrentUser({ username: username.trim(), id: socket.id });
      socket.connect();
      socket.emit('user_join', { username: username.trim() });
    }
  };

  const sendMessage = (content) => {
    if (socket && isConnected && content.trim()) {
      socket.emit('send_message', {
        content: content.trim(),
        room: 'general'
      });
    }
  };

  const sendPrivateMessage = (content, recipientId, recipientUsername) => {
    if (socket && isConnected && content.trim() && recipientId) {
      socket.emit('send_private_message', {
        content: content.trim(),
        recipientId,
        recipientUsername
      });
    }
  };

  const startPrivateChat = (otherUser) => {
    if (socket && otherUser.id !== socket.id) {
      console.log('🔒 Starting private chat with:', otherUser.username);
      
      socket.emit('join_private_chat', { otherUserId: otherUser.id });
      setActiveChat(otherUser.id);
      
      if (!privateConversations.has(otherUser.id)) {
        setPrivateConversations(prev => {
          const newConversations = new Map(prev);
          newConversations.set(otherUser.id, []);
          return newConversations;
        });
      }

      setNotifications(prev => 
        prev.filter(notif => notif.senderId !== otherUser.id)
      );

      socket.emit('get_private_messages', { otherUserId: otherUser.id });
    }
  };

  const switchToGeneral = () => {
    setActiveChat('general');
  };

  const startTyping = () => {
    if (socket && isConnected && activeChat === 'general') {
      socket.emit('typing_start', { room: 'general', type: 'public' });
    }
  };

  const stopTyping = () => {
    if (socket && isConnected && activeChat === 'general') {
      socket.emit('typing_stop', { room: 'general', type: 'public' });
    }
  };

  const startPrivateTyping = (recipientId) => {
    if (socket && isConnected && recipientId) {
      socket.emit('typing_start', { 
        type: 'private', 
        recipientId 
      });
    }
  };

  const stopPrivateTyping = (recipientId) => {
    if (socket && isConnected && recipientId) {
      socket.emit('typing_stop', { 
        type: 'private', 
        recipientId 
      });
    }
  };

  const clearNotifications = (senderId) => {
    setNotifications(prev => 
      prev.filter(notif => notif.senderId !== senderId)
    );
  };

  // NEW: Reaction functions
  const addReaction = (messageId, emoji, isPrivate = false, recipientId = null) => {
    if (socket && isConnected) {
      socket.emit('add_reaction', {
        messageId,
        emoji,
        isPrivate,
        recipientId
      });
    }
  };

  const removeReaction = (messageId, emoji, isPrivate = false, recipientId = null) => {
    if (socket && isConnected) {
      socket.emit('remove_reaction', {
        messageId,
        emoji,
        isPrivate,
        recipientId
      });
    }
  };

  const leaveChat = () => {
    if (socket) {
      socket.disconnect();
      setCurrentUser(null);
      setMessages([]);
      setPrivateConversations(new Map());
      setOnlineUsers([]);
      setTypingUsers([]);
      setPrivateTypingUsers(new Map());
      setNotifications([]);
      setActiveChat('general');
    }
  };

  const value = {
    socket,
    isConnected,
    messages,
    privateConversations,
    onlineUsers,
    currentUser,
    typingUsers,
    privateTypingUsers,
    notifications,
    activeChat,
    joinChat,
    sendMessage,
    sendPrivateMessage,
    startPrivateChat,
    switchToGeneral,
    startTyping,
    stopTyping,
    startPrivateTyping,
    stopPrivateTyping,
    clearNotifications,
    addReaction,
    removeReaction,
    leaveChat
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};