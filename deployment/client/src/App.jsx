// src/App.jsx - Enhanced with Private Messaging
import { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import NotificationSettings from './components/NotificationSettings';
import './App.css';

// Login Component (unchanged)
const LoginForm = () => {
  const [username, setUsername] = useState('');
  const { joinChat } = useSocket();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      joinChat(username);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>🚀 Real-Time Chat</h1>
        <p>Enter your username to join the chat</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username..."
            required
            maxLength={20}
          />
          <button type="submit" disabled={!username.trim()}>
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
};

// Enhanced Online Users Component with Message buttons
const OnlineUsers = () => {
  const { onlineUsers, currentUser, startPrivateChat, notifications, activeChat } = useSocket();

  const getNotificationCount = (userId) => {
    return notifications.filter(notif => notif.senderId === userId).length;
  };

  const otherUsers = onlineUsers.filter(user => user.id !== currentUser?.id);

  return (
    <div className="online-users">
      <h3>🟢 Online Users ({onlineUsers.length})</h3>
      <div className="user-list">
        {otherUsers.map((user) => {
          const notificationCount = getNotificationCount(user.id);
          const isActiveChat = activeChat === user.id;
          
          return (
            <div key={user.id} className={`user-item ${isActiveChat ? 'active-chat' : ''}`}>
              <div className="user-info">
                <span className="user-status">🟢</span>
                <span className="username">{user.username}</span>
                {notificationCount > 0 && (
                  <span className="notification-badge">{notificationCount}</span>
                )}
              </div>
              <button 
                className="message-btn"
                onClick={() => startPrivateChat(user)}
                title={`Message ${user.username}`}
              >
                💬
              </button>
            </div>
          );
        })}
        {otherUsers.length === 0 && (
          <div className="no-users">
            <p>No other users online</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Chat Tabs Component
const ChatTabs = () => {
  const { 
    activeChat, 
    switchToGeneral, 
    privateConversations, 
    onlineUsers, 
    notifications,
    clearNotifications 
  } = useSocket();

  const getNotificationCount = (userId) => {
    return notifications.filter(notif => notif.senderId === userId).length;
  };

  const getUserInfo = (userId) => {
    return onlineUsers.find(user => user.id === userId);
  };

  const handleTabClick = (chatId) => {
    if (chatId === 'general') {
      switchToGeneral();
    } else {
      const userInfo = getUserInfo(chatId);
      if (userInfo) {
        // This will be handled by startPrivateChat, but we can also clear notifications
        clearNotifications(chatId);
      }
    }
  };

  return (
    <div className="chat-tabs">
      {/* General Chat Tab */}
      <button 
        className={`chat-tab ${activeChat === 'general' ? 'active' : ''}`}
        onClick={() => handleTabClick('general')}
      >
        💬 General Chat
      </button>

      {/* Private Chat Tabs */}
      {Array.from(privateConversations.keys()).map(userId => {
        const userInfo = getUserInfo(userId);
        const notificationCount = getNotificationCount(userId);
        
        if (!userInfo) return null; // User might be offline
        
        return (
          <button 
            key={userId}
            className={`chat-tab private-tab ${activeChat === userId ? 'active' : ''}`}
            onClick={() => handleTabClick(userId)}
          >
            🔒 {userInfo.username}
            {notificationCount > 0 && (
              <span className="tab-notification">{notificationCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Message component 
const Message = ({ message, isPrivate = false }) => {
  const { currentUser, addReaction, removeReaction, activeChat } = useSocket();
  const isOwnMessage = message.senderId === currentUser?.id || message.username === currentUser?.username;
  const isSystem = message.isSystem;

  const reactions = message.reactions || {};
  const emojis = ['👍', '❤️', '😂', '😮', '👎'];

  const handleReaction = (emoji) => {
    const emojiReactions = reactions[emoji] || [];
    const userReacted = emojiReactions.some(r => r.userId === currentUser?.id);
    
    if (userReacted) {
      removeReaction(message.id, emoji, isPrivate, isPrivate ? activeChat : null);
    } else {
      addReaction(message.id, emoji, isPrivate, isPrivate ? activeChat : null);
    }
  };

  if (isSystem) {
    return (
      <div className="message system-message">
        <div className="message-content">{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`message ${isOwnMessage ? 'own-message' : ''} ${isPrivate ? 'private-message' : ''}`}>
      <div className="message-header">
        <span className="username">
          {message.username}
          {isPrivate && <span className="private-indicator">🔒</span>}
        </span>
        <span className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="message-content">{message.content}</div>
      
      {/* Reactions Display */}
      {Object.keys(reactions).length > 0 && (
        <div className="reactions-display">
          {Object.entries(reactions).map(([emoji, reactionList]) => (
            <button
              key={emoji}
              className="reaction-badge"
              onClick={() => handleReaction(emoji)}
              title={reactionList.map(r => r.username).join(', ')}
            >
              {emoji} {reactionList.length}
            </button>
          ))}
        </div>
      )}
      
      {/* Quick Reaction Buttons */}
      <div className="reaction-buttons">
        {emojis.map(emoji => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={() => handleReaction(emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};


// Enhanced Chat Interface Component with Notifications
const ChatInterface = () => {
  const [newMessage, setNewMessage] = useState('');
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  const { 
    messages, 
    privateConversations,
    sendMessage, 
    sendPrivateMessage,
    startTyping, 
    stopTyping, 
    startPrivateTyping,
    stopPrivateTyping,
    leaveChat, 
    currentUser,
    isConnected,
    typingUsers,
    privateTypingUsers,
    activeChat,
    onlineUsers
  } = useSocket();

  // Add notification hook
  const {
    notifyNewMessage,
    notifyUserAction,
    clearUnreadCount,
    getTotalUnreadCount,
    soundEnabled,
    browserNotificationsEnabled
  } = useNotifications();

  // Get current chat messages
  const getCurrentMessages = () => {
    if (activeChat === 'general') {
      return messages;
    } else {
      return privateConversations.get(activeChat) || [];
    }
  };

  // Get current typing users
  const getCurrentTypingUsers = () => {
    if (activeChat === 'general') {
      return typingUsers;
    } else {
      const typingUser = privateTypingUsers.get(activeChat);
      return typingUser ? [typingUser] : [];
    }
  };

  // Get chat title with unread count
  const getChatTitle = () => {
    const totalUnread = getTotalUnreadCount();
    const baseTitle = activeChat === 'general' 
      ? '💬 General Chat'
      : (() => {
          const userInfo = onlineUsers.find(user => user.id === activeChat);
          return userInfo ? `🔒 Private chat with ${userInfo.username}` : '🔒 Private Chat';
        })();
    
    return totalUnread > 0 ? `${baseTitle} (${totalUnread})` : baseTitle;
  };

  // Clear unread count when switching chats
  useEffect(() => {
    clearUnreadCount(activeChat);
  }, [activeChat, clearUnreadCount]);

  // Handle new messages for notifications
  useEffect(() => {
    const currentMessages = getCurrentMessages();
    const lastMessage = currentMessages[currentMessages.length - 1];
    
    if (lastMessage && 
        lastMessage.username !== currentUser?.username && 
        !lastMessage.isSystem &&
        lastMessage.timestamp) {
      
      // Only notify for very recent messages (within last 5 seconds)
      const messageAge = Date.now() - new Date(lastMessage.timestamp).getTime();
      if (messageAge < 5000) {
        const isPrivate = activeChat !== 'general';
        notifyNewMessage(lastMessage, isPrivate);
      }
    }
  }, [messages, privateConversations]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      if (activeChat === 'general') {
        sendMessage(newMessage);
      } else {
        const userInfo = onlineUsers.find(user => user.id === activeChat);
        if (userInfo) {
          sendPrivateMessage(newMessage, activeChat, userInfo.username);
        }
      }
      
      setNewMessage('');
      
      // Stop typing when message is sent
      if (isTyping) {
        if (activeChat === 'general') {
          stopTyping();
        } else {
          stopPrivateTyping(activeChat);
        }
        setIsTyping(false);
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Start typing indicator if not already typing
    if (!isTyping && e.target.value.trim()) {
      if (activeChat === 'general') {
        startTyping();
      } else {
        startPrivateTyping(activeChat);
      }
      setIsTyping(true);
    }
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Stop typing after 2 seconds of no typing
    const timeout = setTimeout(() => {
      if (isTyping) {
        if (activeChat === 'general') {
          stopTyping();
        } else {
          stopPrivateTyping(activeChat);
        }
        setIsTyping(false);
      }
    }, 2000);
    
    setTypingTimeout(timeout);
    
    // If input is empty, stop typing immediately
    if (!e.target.value.trim() && isTyping) {
      if (activeChat === 'general') {
        stopTyping();
      } else {
        stopPrivateTyping(activeChat);
      }
      setIsTyping(false);
      clearTimeout(timeout);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  const currentMessages = getCurrentMessages();
  const currentTypingUsers = getCurrentTypingUsers();
  const isPrivateChat = activeChat !== 'general';

  return (
    <div className="chat-container">
      {/* Enhanced Header with notification settings */}
      <div className="chat-header">
        <div className="header-info">
          <h2>{getChatTitle()}</h2>
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="user-info">
          <span>Welcome, {currentUser?.username}!</span>
          
          {/* Notification settings button */}
          <button 
            className="notification-btn"
            onClick={() => setShowNotificationSettings(true)}
            title="Notification Settings"
          >
            🔔
            {!soundEnabled && !browserNotificationsEnabled && (
              <span className="notification-disabled">🔇</span>
            )}
          </button>
          
          <button onClick={leaveChat} className="leave-btn">
            Leave Chat
          </button>
        </div>
      </div>

      {/* Chat Tabs */}
      <ChatTabs />

      <div className="chat-main">
        {/* Sidebar with online users */}
        <aside className="chat-sidebar">
          <OnlineUsers />
        </aside>

        {/* Main chat area */}
        <div className="chat-content">
          {/* Messages area */}
          <div className="messages-container">
            <div className="messages">
              {currentMessages.map((message) => (
                <Message 
                  key={message.id} 
                  message={message} 
                  isPrivate={isPrivateChat}
                />
              ))}
            </div>
            
            {/* Typing Indicator */}
            {currentTypingUsers.length > 0 && (
              <div className="typing-indicator">
                <span className="typing-text">
                  {currentTypingUsers.length === 1
                    ? `${currentTypingUsers[0]} is typing`
                    : `${currentTypingUsers.join(' and ')} are typing`}
                </span>
                <span className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            )}
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage} className="message-form">
            {/* Typing status indicator */}
            {isTyping && (
              <div className="typing-status">
                You are typing...
              </div>
            )}
            
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              onKeyPress={handleKeyPress}
              placeholder={
                isConnected 
                  ? (isPrivateChat ? "Type a private message..." : "Type your message...")
                  : "Connecting..."
              }
              disabled={!isConnected}
              autoComplete="off"
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim() || !isConnected}
              title={!isConnected ? "Connecting..." : "Send message"}
            >
              {!isConnected ? "..." : "Send"}
            </button>
          </form>
        </div>
      </div>

      {/* Notification Settings Modal */}
      <NotificationSettings 
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </div>
  );
};
// Main App Component
const AppContent = () => {
  const { currentUser } = useSocket();
  
  return currentUser ? <ChatInterface /> : <LoginForm />;
};

function App() {
  return (
    <SocketProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </SocketProvider>
  );
}

export default App;