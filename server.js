// Add this inside io.on('connection', (socket) => { ... })
socket.on('requestRematch', (roomID) => {
    const room = rooms[roomID];
    if (room) {
        room.moves = { X: [], O: [] };
        room.turn = 'X';
        // Tell everyone in the room to reset their board
        io.to(roomID).emit('rematchTrigger');
        io.to(roomID).emit('statusUpdate', "Player X's Turn");
    }
});