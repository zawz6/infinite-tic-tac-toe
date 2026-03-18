const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', (rawRoomID) => {
        const roomID = rawRoomID.trim().toLowerCase();
        socket.join(roomID);

        if (!rooms[roomID]) {
            rooms[roomID] = { players: {}, moves: { X: [], O: [] }, turn: 'X', active: false };
        }

        const playersInRoom = Object.keys(rooms[roomID].players);
        if (playersInRoom.length < 2) {
            const role = playersInRoom.length === 0 ? 'X' : 'O';
            rooms[roomID].players[socket.id] = role;
            socket.emit('playerRole', role);

            if (Object.keys(rooms[roomID].players).length === 2) {
                rooms[roomID].active = true;
                io.to(roomID).emit('gameStart', "Opponent Joined! Player X's Turn");
            } else {
                socket.emit('statusUpdate', "Waiting for player 2...");
            }
        } else {
            socket.emit('error', 'Room is full');
        }
    });

    socket.on('makeMove', ({ roomID, index }) => {
        const rID = roomID.trim().toLowerCase();
        const room = rooms[rID];
        if (!room || !room.active) return;

        const role = room.players[socket.id];
        if (role !== room.turn) return;

        // --- BUG FIX: Check if square is already taken ---
        const occupied = room.moves.X.includes(index) || room.moves.O.includes(index);
        if (occupied) return; 

        if (room.moves[role].length === 3) {
            const oldest = room.moves[role].shift();
            io.to(rID).emit('removePiece', oldest);
        }

        room.moves[role].push(index);
        const win = checkWin(room.moves[role]);
        io.to(rID).emit('updateBoard', { index, role, win });

        if (!win) {
            room.turn = room.turn === 'X' ? 'O' : 'X';
            io.to(rID).emit('statusUpdate', `Player ${room.turn}'s Turn`);
        } else {
            room.active = false;
        }
    });

    socket.on('requestRematch', (rawRoomID) => {
        const rID = rawRoomID.trim().toLowerCase();
        const room = rooms[rID];
        if (room) {
            room.moves = { X: [], O: [] };
            room.turn = 'X';
            room.active = true;
            io.to(rID).emit('rematchTrigger');
            io.to(rID).emit('statusUpdate', "Player X's Turn");
        }
    });
});

function checkWin(moves) {
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const win = combos.find(c => c.every(idx => moves.includes(idx)));
    if (!win) return null;
    const lines = {'0,1,2':[10,50,314,50],'3,4,5':[10,162,314,162],'6,7,8':[10,274,314,274],'0,3,6':[50,10,50,314],'1,4,7':[162,10,162,314],'2,5,8':[274,10,274,314],'0,4,8':[10,10,314,314],'2,4,6':[314,10,10,314]};
    return { combo: win, l: lines[win.join(',')] };
}

server.listen(process.env.PORT || 3000);
