const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    // JOIN ROOM
    socket.on('joinRoom', (roomID) => {
        socket.join(roomID);
        if (!rooms[roomID]) {
            rooms[roomID] = { players: {}, moves: { X: [], O: [] }, turn: 'X' };
        }

        const playerCount = Object.keys(rooms[roomID].players).length;
        if (playerCount < 2) {
            const role = playerCount === 0 ? 'X' : 'O';
            rooms[roomID].players[socket.id] = role;
            socket.emit('playerRole', role);
        } else {
            socket.emit('error', 'Room is full');
        }

        io.to(roomID).emit('statusUpdate', `Player ${rooms[roomID].turn}'s Turn`);
    });

    // MAKE MOVE
    socket.on('makeMove', ({ roomID, index }) => {
        const room = rooms[roomID];
        if (!room) return;

        const role = room.players[socket.id];
        if (role !== room.turn) return;

        if (room.moves[role].length === 3) {
            const oldest = room.moves[role].shift();
            io.to(roomID).emit('removePiece', oldest);
        }

        room.moves[role].push(index);
        const win = checkWin(room.moves[role]);
        
        io.to(roomID).emit('updateBoard', { index, role, win });

        if (!win) {
            room.turn = room.turn === 'X' ? 'O' : 'X';
            io.to(roomID).emit('statusUpdate', `Player ${room.turn}'s Turn`);
        }
    });

    // REMATCH
    socket.on('requestRematch', (roomID) => {
        const room = rooms[roomID];
        if (room) {
            room.moves = { X: [], O: [] };
            room.turn = 'X';
            io.to(roomID).emit('rematchTrigger');
        }
    });
});

function checkWin(moves) {
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const win = combos.find(c => c.every(idx => moves.includes(idx)));
    if (!win) return null;
    const lines = {
        '0,1,2': [10,50,314,50], '3,4,5': [10,162,314,162], '6,7,8': [10,274,314,274],
        '0,3,6': [50,10,50,314], '1,4,7': [162,10,162,314], '2,5,8': [274,10,274,314],
        '0,4,8': [10,10,314,314], '2,4,6': [314,10,10,314]
    };
    return { combo: win, l: lines[win.join(',')] };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
