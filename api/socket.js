import { Server } from "socket.io";
let io;

export default {
  init: (server, options) => {
    io = new Server(server, options);
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io has not been initialized!");
    }
    return io;
  }
};
