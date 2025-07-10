// src/components/NotificationSettings.jsx - Notification settings panel
import { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';

const NotificationSettings = ({ isOpen, onClose }) => {
  const {
    notificationPermission,
    soundEnabled,
    browserNotificationsEnabled,
    toggleSound,
    toggleBrowserNotifications,
    requestNotificationPermission,
    playSound
  } = useNotifications();

  const [isTestingSound, setIsTestingSound] = useState(false);

  const handleTestSound = async (soundType) => {
    setIsTestingSound(true);
    playSound(soundType);
    
    // Visual feedback
    setTimeout(() => {
      setIsTestingSound(false);
    }, 1000);
  };

  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      // Show a test notification
      new Notification('Notifications enabled!', {
        body: 'You will now receive chat notifications',
        icon: '/chat-icon.png'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notification-settings-overlay">
      <div className="notification-settings-panel">
        <div className="settings-header">
          <h3>🔔 Notification Settings</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* Browser Notifications */}
          <div className="setting-group">
            <h4>🌐 Browser Notifications</h4>
            <div className="setting-item">
              <div className="setting-info">
                <span>Desktop notifications</span>
                <small>Get notified even when the tab is not active</small>
              </div>
              <div className="setting-controls">
                {notificationPermission === 'denied' && (
                  <span className="permission-status denied">
                    ❌ Blocked - Enable in browser settings
                  </span>
                )}
                {notificationPermission === 'default' && (
                  <button 
                    className="permission-btn"
                    onClick={handleRequestPermission}
                  >
                    Enable Notifications
                  </button>
                )}
                {notificationPermission === 'granted' && (
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={browserNotificationsEnabled}
                      onChange={toggleBrowserNotifications}
                    />
                    <span className="slider"></span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Sound Notifications */}
          <div className="setting-group">
            <h4>🔊 Sound Notifications</h4>
            <div className="setting-item">
              <div className="setting-info">
                <span>Sound alerts</span>
                <small>Play sounds for new messages and events</small>
              </div>
              <div className="setting-controls">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={toggleSound}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Sound Test Buttons */}
          {soundEnabled && (
            <div className="setting-group">
              <h4>🎵 Test Sounds</h4>
              <div className="sound-test-buttons">
                <button 
                  className={`test-btn ${isTestingSound ? 'testing' : ''}`}
                  onClick={() => handleTestSound('message')}
                  disabled={isTestingSound}
                >
                  💬 Message Sound
                </button>
                <button 
                  className={`test-btn ${isTestingSound ? 'testing' : ''}`}
                  onClick={() => handleTestSound('privateMessage')}
                  disabled={isTestingSound}
                >
                  🔒 Private Message
                </button>
                <button 
                  className={`test-btn ${isTestingSound ? 'testing' : ''}`}
                  onClick={() => handleTestSound('userJoin')}
                  disabled={isTestingSound}
                >
                  👋 User Join
                </button>
                <button 
                  className={`test-btn ${isTestingSound ? 'testing' : ''}`}
                  onClick={() => handleTestSound('reaction')}
                  disabled={isTestingSound}
                >
                  👍 Reaction
                </button>
              </div>
            </div>
          )}

          {/* Notification Info */}
          <div className="setting-group">
            <h4>ℹ️ How it works</h4>
            <div className="notification-info">
              <ul>
                <li>🖥️ <strong>Desktop notifications</strong> appear when the chat tab is not active</li>
                <li>🔊 <strong>Sound alerts</strong> play for all messages and events</li>
                <li>📱 <strong>Unread counts</strong> are shown in the page title and chat tabs</li>
                <li>🎯 <strong>Smart notifications</strong> - no spam when you're actively chatting</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;