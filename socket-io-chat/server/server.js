// server/server.js - Enhanced server with private messaging and reactions
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // React dev server
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Store connected users with enhanced data
const connectedUsers = new Map();

// Helper function to create private room name
const createPrivateRoom = (userId1, userId2) => {
  return [userId1, userId2].sort().join('-private-');
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔗 New client connected: ${socket.id}`);

  // Handle user joining
  socket.on('user_join', (userData) => {
    console.log(`👤 User joined: ${userData.username}`);
    
    // Store enhanced user data
    connectedUsers.set(socket.id, {
      id: socket.id,
      username: userData.username,
      joinedAt: new Date(),
      status: 'online'
    });

    // Join the general room
    socket.join('general');

    // Notify others that user joined
    socket.to('general').emit('user_joined', {
      username: userData.username,
      message: `${userData.username} joined the chat`,
      timestamp: new Date()
    });

    // Send current online users to the new user
    const onlineUsers = Array.from(connectedUsers.values());
    socket.emit('online_users', onlineUsers);

    // Broadcast updated user list to all users
    io.to('general').emit('user_list_updated', onlineUsers);
  });

  // Handle public messages (general chat)
  socket.on('send_message', (messageData) => {
    const user = connectedUsers.get(socket.id);
    
    if (user) {
      const message = {
        id: Date.now(),
        username: user.username,
        content: messageData.content,
        timestamp: new Date(),
        room: messageData.room || 'general',
        type: 'public'
      };

      console.log(`💬 Public message from ${user.username}: ${messageData.content}`);

      // Send message to all users in the room (including sender)
      io.to(message.room).emit('receive_message', message);
    }
  });

  // Handle private messages
  socket.on('send_private_message', (messageData) => {
    const sender = connectedUsers.get(socket.id);
    
    if (sender && messageData.recipientId) {
      const privateRoom = createPrivateRoom(socket.id, messageData.recipientId);
      
      const message = {
        id: Date.now(),
        username: sender.username,
        senderId: socket.id,
        recipientId: messageData.recipientId,
        content: messageData.content,
        timestamp: new Date(),
        room: privateRoom,
        type: 'private'
      };

      console.log(`💌 Private message from ${sender.username} to ${messageData.recipientUsername}: ${messageData.content}`);

      // Join both users to the private room (if not already joined)
      socket.join(privateRoom);
      
      // Find recipient socket and join them to the room
      const recipientSocket = io.sockets.sockets.get(messageData.recipientId);
      if (recipientSocket) {
        recipientSocket.join(privateRoom);
        
        // Send message to both sender and recipient
        io.to(privateRoom).emit('receive_private_message', message);
        
        // Send notification to recipient about new private message
        recipientSocket.emit('private_message_notification', {
          senderId: socket.id,
          senderUsername: sender.username,
          content: messageData.content,
          timestamp: new Date()
        });
      } else {
        // Recipient is offline, send error back to sender
        socket.emit('message_error', {
          error: 'User is no longer online',
          originalMessage: messageData
        });
      }
    }
  });

  // Handle message reactions
  socket.on('add_reaction', (reactionData) => {
    const user = connectedUsers.get(socket.id);
    
    if (user && reactionData.messageId && reactionData.emoji) {
      const reaction = {
        messageId: reactionData.messageId,
        emoji: reactionData.emoji,
        userId: socket.id,
        username: user.username,
        timestamp: new Date()
      };

      console.log(`👍 Reaction from ${user.username}: ${reactionData.emoji} on message ${reactionData.messageId}`);

      // Broadcast reaction to appropriate room
      if (reactionData.isPrivate && reactionData.recipientId) {
        const privateRoom = createPrivateRoom(socket.id, reactionData.recipientId);
        io.to(privateRoom).emit('reaction_added', reaction);
      } else {
        io.to('general').emit('reaction_added', reaction);
      }
    }
  });

  socket.on('remove_reaction', (reactionData) => {
    const user = connectedUsers.get(socket.id);
    
    if (user && reactionData.messageId && reactionData.emoji) {
      console.log(`👎 Removing reaction from ${user.username}: ${reactionData.emoji} on message ${reactionData.messageId}`);

      // Broadcast reaction removal to appropriate room
      if (reactionData.isPrivate && reactionData.recipientId) {
        const privateRoom = createPrivateRoom(socket.id, reactionData.recipientId);
        io.to(privateRoom).emit('reaction_removed', {
          messageId: reactionData.messageId,
          emoji: reactionData.emoji,
          userId: socket.id
        });
      } else {
        io.to('general').emit('reaction_removed', {
          messageId: reactionData.messageId,
          emoji: reactionData.emoji,
          userId: socket.id
        });
      }
    }
  });

  // Handle joining a private conversation
  socket.on('join_private_chat', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user && data.otherUserId) {
      const privateRoom = createPrivateRoom(socket.id, data.otherUserId);
      socket.join(privateRoom);
      console.log(`🔒 ${user.username} joined private chat room: ${privateRoom}`);
    }
  });

  // Handle typing indicators for both public and private
  socket.on('typing_start', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (data.type === 'private' && data.recipientId) {
        // Private typing indicator
        const recipientSocket = io.sockets.sockets.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('user_typing_private', {
            senderId: socket.id,
            username: user.username,
            isTyping: true
          });
        }
      } else {
        // Public typing indicator
        socket.to(data.room || 'general').emit('user_typing', {
          username: user.username,
          isTyping: true
        });
      }
    }
  });

  socket.on('typing_stop', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (data.type === 'private' && data.recipientId) {
        // Private typing indicator
        const recipientSocket = io.sockets.sockets.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('user_typing_private', {
            senderId: socket.id,
            username: user.username,
            isTyping: false
          });
        }
      } else {
        // Public typing indicator
        socket.to(data.room || 'general').emit('user_typing', {
          username: user.username,
          isTyping: false
        });
      }
    }
  });

  // Handle getting private chat history (placeholder for future database integration)
  socket.on('get_private_messages', (data) => {
    // For now, we'll just send an empty array
    // In a real app, you'd fetch from database
    socket.emit('private_messages_history', {
      otherUserId: data.otherUserId,
      messages: []
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    
    if (user) {
      console.log(`👋 User disconnected: ${user.username}`);
      
      // Remove user from connected users
      connectedUsers.delete(socket.id);

      // Notify others that user left
      socket.to('general').emit('user_left', {
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date()
      });

      // Broadcast updated user list
      const onlineUsers = Array.from(connectedUsers.values());
      io.to('general').emit('user_list_updated', onlineUsers);
    }
  });
});

// Basic API endpoint for health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    connectedUsers: connectedUsers.size,
    timestamp: new Date()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`🔗 Ready for connections from http://localhost:5173`);
});