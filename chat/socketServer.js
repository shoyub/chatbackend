// 📁 socketServer.js
import { Server } from "socket.io";
import http from "http";

const server = http.createServer();

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const users = new Map();

io.on("connection", (socket) => {
  console.log("🟢 New connection:", socket.id);

  socket.on("register", (username) => {
    // Remove any existing registration for this username
    const existingSocketId = users.get(username);
    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(
        `🔄 Re-registering ${username} from ${existingSocketId} to ${socket.id}`
      );
    }

    users.set(username, socket.id);
    socket.username = username;
    console.log(`✅ Registered: ${username} → ${socket.id}`);
    console.log("📦 Current users map:", Array.from(users.entries()));
  });

  // Handle call initiation (this will force both users to join video call interface)
  socket.on("initiate-call", ({ to, from }) => {
    const targetId = users.get(to);
    if (targetId) {
      // Force the target user to join the call interface
      io.to(targetId).emit("force-join-call", { from });

      // Also notify about call initiation
      io.to(targetId).emit("call-initiated", { from });

      console.log(`🚀 Forcing ${to} to join call with ${from}`);
    } else {
      console.warn("❌ Cannot initiate call, user not found:", to);
      socket.emit("call-failed", {
        message: `User ${to} is not available`,
        target: to,
      });
    }
  });

  // Legacy call-user event (keeping for backward compatibility)
  socket.on("call-user", ({ to, from }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("incoming-call", { from });
      console.log(`📞 ${from} is calling ${to}`);
    } else {
      console.warn("❌ Cannot call, user not found:", to);
      socket.emit("call-failed", {
        message: `User ${to} is not available`,
        target: to,
      });
    }
  });

  socket.on("offer", ({ to, offer }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("offer", { from: socket.username, offer });
      console.log(`📤 Offer sent from ${socket.username} to ${to}`);
    } else {
      console.warn("❌ Cannot send offer, user not found:", to);
    }
  });

  socket.on("answer", ({ to, answer }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("answer", { answer });
      console.log(`📥 Answer sent to ${to}`);
    } else {
      console.warn("❌ Cannot send answer, user not found:", to);
    }
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("ice-candidate", { candidate });
      console.log(`❄️ ICE sent to ${to}`);
    } else {
      console.warn("❌ Cannot send ICE candidate, user not found:", to);
    }
  });

  socket.on("call-ended", ({ to }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("call-ended", { from: socket.username });
      console.log(`📞 Call ended between ${socket.username} and ${to}`);
    }
  });

  // Handle regular messages
  socket.on("send-message", ({ to, message }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("message", {
        from: socket.username,
        message,
        timestamp: new Date().toISOString(),
      });
      console.log(`💬 Message from ${socket.username} to ${to}: ${message}`);
    } else {
      console.warn("❌ Cannot send message, user not found:", to);
      socket.emit("message-failed", {
        message: `User ${to} is not available`,
        target: to,
      });
    }
  });

  // Handle video call request via message
  socket.on("request-video-call", ({ to }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("video-call-request", { from: socket.username });
      console.log(`📹 Video call request from ${socket.username} to ${to}`);
    } else {
      console.warn("❌ Cannot request video call, user not found:", to);
      socket.emit("call-failed", {
        message: `User ${to} is not available`,
        target: to,
      });
    }
  });

  // Handle video call rejection
  socket.on("video-call-rejected", ({ to }) => {
    const targetId = users.get(to);
    if (targetId) {
      io.to(targetId).emit("video-call-rejected", { from: socket.username });
      console.log(`❌ ${socket.username} rejected video call from ${to}`);
    }
  });

  // Get online users list
  socket.on("get-online-users", () => {
    const onlineUsers = Array.from(users.keys()).filter(
      (user) => user !== socket.username
    );
    socket.emit("online-users", onlineUsers);
    console.log(`📋 Sent online users to ${socket.username}:`, onlineUsers);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      users.delete(socket.username);
      console.log(`🔴 ${socket.username} disconnected`);
      console.log("📦 Remaining users:", Array.from(users.entries()));

      // Notify other users that this user went offline
      socket.broadcast.emit("user-offline", { username: socket.username });
    }
  });
});

server.listen(3001, () => {
  console.log("🚀 Socket.IO server running on port 3001");
});
