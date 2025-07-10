// src/context/NotificationContext.jsx - Notification system
import { createContext, useContext, useEffect, useState } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState(new Map());
  const [isTabActive, setIsTabActive] = useState(true);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Play simple beep sound
  const playSound = (soundType = 'message') => {
    if (!soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different sound types
      const frequencies = {
        message: 800,
        privateMessage: 1000,
        userJoin: 600,
        userLeave: 400,
        reaction: 1200
      };
      
      oscillator.frequency.value = frequencies[soundType] || 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.log('Sound notification failed:', error);
    }
  };

  // Show browser notification
  const showBrowserNotification = (title, options = {}) => {
    if (!browserNotificationsEnabled || notificationPermission !== 'granted' || isTabActive) {
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/chat-icon.png',
        tag: 'chat-notification',
        requireInteraction: false,
        ...options
      });

      setTimeout(() => {
        notification.close();
      }, 5000);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.log('Browser notification failed:', error);
    }
  };

  // Handle new message notification
  const notifyNewMessage = (message, isPrivate = false) => {
    const soundType = isPrivate ? 'privateMessage' : 'message';
    
    playSound(soundType);

    if (!isTabActive) {
      const title = isPrivate 
        ? `Private message from ${message.username}`
        : `New message from ${message.username}`;
      
      showBrowserNotification(title, {
        body: message.content
      });
    }

    // Update page title
    const chatId = isPrivate ? message.senderId : 'general';
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      const currentCount = newCounts.get(chatId) || 0;
      newCounts.set(chatId, currentCount + 1);
      return newCounts;
    });

    updatePageTitle();
  };

  // Handle user join/leave notifications
  const notifyUserAction = (username, action) => {
    if (action === 'joined') {
      playSound('userJoin');
      if (!isTabActive) {
        showBrowserNotification('User joined', {
          body: `${username} joined the chat`
        });
      }
    } else if (action === 'left') {
      playSound('userLeave');
      if (!isTabActive) {
        showBrowserNotification('User left', {
          body: `${username} left the chat`
        });
      }
    }
  };

  // Clear unread count for a specific chat
  const clearUnreadCount = (chatId) => {
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.delete(chatId);
      return newCounts;
    });
    updatePageTitle();
  };

  // Update page title with total unread count
  const updatePageTitle = () => {
    const totalUnread = Array.from(unreadCounts.values()).reduce((sum, count) => sum + count, 0);
    
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Real-Time Chat`;
    } else {
      document.title = 'Real-Time Chat';
    }
  };

  // Get total unread count
  const getTotalUnreadCount = () => {
    return Array.from(unreadCounts.values()).reduce((sum, count) => sum + count, 0);
  };

  // Toggle functions
  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  const toggleBrowserNotifications = () => {
    setBrowserNotificationsEnabled(prev => !prev);
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    }
    return notificationPermission;
  };

  const value = {
    notificationPermission,
    soundEnabled,
    browserNotificationsEnabled,
    unreadCounts,
    isTabActive,
    notifyNewMessage,
    notifyUserAction,
    clearUnreadCount,
    getTotalUnreadCount,
    toggleSound,
    toggleBrowserNotifications,
    requestNotificationPermission,
    playSound,
    showBrowserNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
