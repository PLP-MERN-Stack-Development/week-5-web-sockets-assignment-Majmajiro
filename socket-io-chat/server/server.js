// server/server.js - Production ready server
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

// Production-ready CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  // Add your Render frontend URL when you get it
].filter(Boolean);

// Configure Socket.IO with production CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware with production CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
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
    
    connectedUsers.set(socket.id, {
      id: socket.id,
      username: userData.username,
      joinedAt: new Date(),
      status: 'online'
    });

    socket.join('general');

    socket.to('general').emit('user_joined', {
      username: userData.username,
      message: `${userData.username} joined the chat`,
      timestamp: new Date()
    });

    const onlineUsers = Array.from(connectedUsers.values());
    socket.emit('online_users', onlineUsers);
    io.to('general').emit('user_list_updated', onlineUsers);
  });

  // Handle public messages
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

      socket.join(privateRoom);
      
      const recipientSocket = io.sockets.sockets.get(messageData.recipientId);
      if (recipientSocket) {
        recipientSocket.join(privateRoom);
        io.to(privateRoom).emit('receive_private_message', message);
        
        recipientSocket.emit('private_message_notification', {
          senderId: socket.id,
          senderUsername: sender.username,
          content: messageData.content,
          timestamp: new Date()
        });
      } else {
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

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (data.type === 'private' && data.recipientId) {
        const recipientSocket = io.sockets.sockets.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('user_typing_private', {
            senderId: socket.id,
            username: user.username,
            isTyping: true
          });
        }
      } else {
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
        const recipientSocket = io.sockets.sockets.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('user_typing_private', {
            senderId: socket.id,
            username: user.username,
            isTyping: false
          });
        }
      } else {
        socket.to(data.room || 'general').emit('user_typing', {
          username: user.username,
          isTyping: false
        });
      }
    }
  });

  socket.on('join_private_chat', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user && data.otherUserId) {
      const privateRoom = createPrivateRoom(socket.id, data.otherUserId);
      socket.join(privateRoom);
      console.log(`🔒 ${user.username} joined private chat room: ${privateRoom}`);
    }
  });

  socket.on('get_private_messages', (data) => {
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
      connectedUsers.delete(socket.id);

      socket.to('general').emit('user_left', {
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date()
      });

      const onlineUsers = Array.from(connectedUsers.values());
      io.to('general').emit('user_list_updated', onlineUsers);
    }
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Socket.IO Chat Server Running',
    connectedUsers: connectedUsers.size,
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    connectedUsers: connectedUsers.size,
    timestamp: new Date()
  });
});

// Start server with production configuration
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`💻 CORS enabled for origins: ${allowedOrigins.join(', ')}`);
});