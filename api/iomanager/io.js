/* eslint-disable no-unused-vars */

module.exports = {
    addFriend: function (user, friend, socket, io) {
        console.log('Adding friend', user, friend);
        io.to(socket.id).emit('friendRequest', { id: user });
        console.log('Friend request sent');
    },

    getSocket: async function (io, id) {
        const clients = await io.fetchSockets();
        for (const client of clients) {
            if (client.user.id === id) {
                return client;
            }
        }
        return null;
    }
};