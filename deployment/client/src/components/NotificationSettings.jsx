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
    
    setTimeout(() => {
      setIsTestingSound(false);
    }, 1000);
  };

  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
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
          <div className="setting-group">
            <h4>🌐 Browser Notifications</h4>
            <div className="setting-item">
              <div className="setting-info">
                <span>Desktop notifications</span>
                <small>Get notified when the tab is not active</small>
              </div>
              <div className="setting-controls">
                {notificationPermission === 'denied' && (
                  <span className="permission-status denied">
                    ❌ Blocked
                  </span>
                )}
                {notificationPermission === 'default' && (
                  <button 
                    className="permission-btn"
                    onClick={handleRequestPermission}
                  >
                    Enable
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

          <div className="setting-group">
            <h4>🔊 Sound Notifications</h4>
            <div className="setting-item">
              <div className="setting-info">
                <span>Sound alerts</span>
                <small>Play sounds for messages</small>
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

          {soundEnabled && (
            <div className="setting-group">
              <h4>🎵 Test Sounds</h4>
              <div className="sound-test-buttons">
                <button 
                  className={`test-btn ${isTestingSound ? 'testing' : ''}`}
                  onClick={() => handleTestSound('message')}
                  disabled={isTestingSound}
                >
                  💬 Message
                </button>
                <button 
                  className={`test-btn ${isTestingSound ? 'testing' : ''}`}
                  onClick={() => handleTestSound('privateMessage')}
                  disabled={isTestingSound}
                >
                  🔒 Private
                </button>
              </div>
            </div>
          )}
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
