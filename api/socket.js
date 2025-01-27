let io;

const exported = {
  init: (server, options) => {
    io = require('socket.io')(server, options);
    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io has not been initialized!");
    }
    return io;
  }
};

export default exported;

export const {
  init,
  getIO
} = exported;
