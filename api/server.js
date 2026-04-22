const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    path: '/socket.io/'
});

// Store room state
const rooms = {};

io.on('connection', (socket) => {
    socket.on('join_game', ({ room, name }) => {
        socket.join(room);
        if (!rooms[room]) rooms[room] = { players: {}, blocks: {} };

        // Add player to state
        rooms[room].players[socket.id] = { 
            id: socket.id, 
            name, 
            pos: { x: 0.5, y: 2, z: 0.5 },
            health: 20
        };

        // Send current world state to the new player
        socket.emit('game_joined', rooms[room]);
        
        // Notify others
        socket.to(room).emit('player_joined', rooms[room].players[socket.id]);
    });

    socket.on('move', ({ room, pos, rot }) => {
        if (rooms[room] && rooms[room].players[socket.id]) {
            rooms[room].players[socket.id].pos = pos;
            socket.to(room).emit('player_update', socket.id, pos, rot);
        }
    });

    socket.on('place_block', ({ room, key, type, pos }) => {
        socket.to(room).emit('sync_block', { key, type, pos });
    });

    socket.on('place_crystal', ({ room, pos }) => {
        socket.to(room).emit('sync_crystal', pos);
    });

    socket.on('detonate', ({ room, pos, type }) => {
        socket.to(room).emit('sync_detonation', { pos, type });
    });

    socket.on('damage_player', ({ room, targetId, amount }) => {
        if (rooms[room] && rooms[room].players[targetId]) {
            rooms[room].players[targetId].health -= amount;
            io.to(room).emit('player_health_update', targetId, rooms[room].players[targetId].health);
        }
    });

    socket.on('disconnect', () => {
        for (let room in rooms) {
            if (rooms[room].players[socket.id]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit('player_left', socket.id);
            }
        }
    });
});

module.exports = server;
