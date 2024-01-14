class Room {
    constructor(username, title, isPrivate) {
        this.owner = username;
        this.roomName = title;
        this.banList = ["@@@"];
        this.isPrivate = isPrivate;
        this.password = null;
    }

    banUser(username) {
        this.banList.push(username);
    }

    setPassword(password) {
        this.password = password;
    }
}

class User {
    constructor(username, currentRoom) {
        this.username = username;
        this.currentRoom = currentRoom;
    }

    updateRoom(room) {
        this.currentRoom = room;
    }
}

let roomList = {}; 
let polls = {};
let nextPollId = 0;

function usersInRoom(roomName) { 
    let users = [];
    let sockets = io.sockets.adapter.rooms.get(roomName);
    if (sockets) { 
        for (let socketId of sockets) {
            let user = io.sockets.sockets.get(socketId).nickname;
            users.push(user);
        }
    }
    return users;
}

roomList["Default"] = new Room("", "Default", false);

// Require the packages we will use:
const http = require("http"),
fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer({maxPayload: 100 * 1024 * 1024},function (req, res) {
    
    // This callback runs when a new connection is made to our HTTP server.
    if (req.url === "/") {
        fs.readFile(file, function (err, data) {
            // This callback runs when the client.html file has been read from the filesystem.

            if (err) return res.writeHead(500);
            res.writeHead(200);
            res.end(data);
        });
    } else if (req.url.match('\.css')) {        
        let fileStream = fs.createReadStream(__dirname + req.url, "UTF-8");
        res.writeHead(200, { "ContentType": "text/css" })
        fileStream.pipe(res);
    } else if (req.url.match('\.js')) {        
        let fileStream = fs.createReadStream(__dirname + req.url, "UTF-8");
        res.writeHead(200, { "ContentType": "text/javascript" })
        fileStream.pipe(res);
    } 
    else if (req.url.match('\.mp3')) {        
        let fileStream = fs.createReadStream(__dirname + req.url, "UTF-8");
        res.writeHead(200, { "ContentType": "audio/mpeg" })
        fileStream.pipe(res);
    } 
        
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    maxHttpBufferSize: 1e8
    //pingTimeout: 60000,
    //wsEngine: 'ws'
});

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    socket.on("username", function(data){
        // TODO: check if usernames are the same
        socket.nickname = data.username;
        socket.currentRoom = "Default";
        socket.join(socket.currentRoom);
        console.log(`User connected with ID: ${socket.id} and joined default room.`);
        updateUsers();
    });
    
    // This callback runs when a new Socket.IO connection is established.

    socket.on('message_to_server', function (data) {
        console.log(`Message from ${data.username} in room ${socket.currentRoom}: ${data.message}`);
        console.log("message: " + data["message"]); // log it to the Node.JS output
        io.to(socket.currentRoom).emit("message_to_client", { username: data["username"], message: data["message"] })
    });

    socket.on('send_private_message', function(data) {
        let targetSocket = findSocketByUsername(data.targetUsername);
        if (targetSocket && targetSocket.currentRoom === socket.currentRoom) {
            targetSocket.emit("receive_private_message", { from: socket.nickname, message: data.message });
        } else {
            socket.emit("error", {message: "User is not in the same room or does not exist."});
        }
    });

    function findSocketByUsername(username) { 
        let allSockets =  io.sockets.sockets;
        for (let [id, socket] of allSockets) {
            if (socket.nickname === username) {
                return socket;
            }
        }
        return null;
    }

    socket.on("get_audio", function (){
        io.to(socket.currentRoom).emit("receive_audio", );
    });

    socket.on('create_room', function (data) {
        let thisRoom = new Room(data.username, data.roomName, data.isPrivate);
        if (thisRoom.isPrivate) {
            thisRoom.setPassword(data.password);
        }
        
        if(roomList[data.roomName]) { 
            socket.emit("error", {message: "Room already exists."});
            return;
        }
        else {
            roomList[data.roomName] = thisRoom;
        }
        
        socket.nickname = data.username;
        socket.leave(socket.currentRoom);
        socket.join(thisRoom.roomName);
        socket.currentRoom = data.roomName;
        io.sockets.emit("room_created", { 'roomName': thisRoom.roomName, 'isPrivate': thisRoom.isPrivate, 'creator': thisRoom.username }) // broadcast the room 
        console.log(`Room created: ${data.roomName} by user: ${data.username}`);
        updateUsers();
    });

    socket.on('join_room', function (data) {
        console.log(`User ${data.username} attempting to join room: ${data.roomName}`);
        if(roomList[data.roomName]) { 
            if(roomList[data.roomName].isPrivate && roomList[data.roomName].password !== data.password) { 
                socket.emit("error", {message: "Incorrect Password."});
                return;
            } else {
                let banRoom = roomList[data.roomName];
                let isBanned = false;
                console.log(banRoom.banList);
                if (banRoom.banList) {
                    isBanned = banRoom.banList.includes(data.username);
                }
                if (!isBanned) {
                    socket.nickname = data.username;
                    socket.leave(socket.currentRoom);
                    socket.currentRoom = data.roomName;
                    socket.join(socket.currentRoom);
                    // function that gets names in room
                    updateUsers();
                }
                else {
                    socket.emit("error", {message: "You have been banned from this room."});
                }
            }
        }
        else {
            socket.emit("error", {message: "You are trying to join a room that does not exist."});
            return;
        }
    });

    socket.on("update_user_list", (data) => {
        updateUsers();
    });

    function updateUsers() {
        let currentUsersInRoom = usersInRoom(socket.currentRoom);
        console.log(currentUsersInRoom);
        let roomOwner = "";
        if (socket.currentRoom) {
            console.log(socket.currentRoom);
            roomOwner = roomList[socket.currentRoom].owner;
        }
        io.to(socket.currentRoom).emit("update_user_list", {"users": currentUsersInRoom, "roomOwner": roomOwner, "currentRoom": socket.currentRoom});
    }

    socket.on("disconnect", (reason) => {
        updateUsers(); 
    });
    
    socket.on('get_rooms', function (data){
        let thisList = {};
        for (const [key, value] of Object.entries(roomList)) {
            if (!value.banList.includes(data.username)) {
                thisList[key] = {roomName: value.roomName, isPrivate: value.isPrivate, owner: value.owner};
            }
        }
        console.log(thisList);
        socket.emit("rooms", {roomList: thisList});
    });

    socket.on('ban_user', function(data){
        const room = roomList[data.roomName];
        if (room && socket.nickname === room.owner) {
            console.log("passed admin check");
            const banned = room.banUser(data.username);
            let sockets = io.sockets.adapter.rooms.get(data.roomName);
            let bannedSocket = null;
            for (let socketId of sockets) {
                let user = io.sockets.sockets.get(socketId).nickname;
                if (user == data.username) {
                    bannedSocket = io.sockets.sockets.get(socketId);
                }
            }

            console.log("found socket " + bannedSocket.nickname);

            bannedSocket.leave(bannedSocket.currentRoom);
            bannedSocket.currentRoom = "Default";
            bannedSocket.join(bannedSocket.currentRoom);
            io.emit('user_banned', { username: data.username });
        }
        updateUsers();
    });

    socket.on('kick_user', function(data){
        const room = roomList[data.roomName];
        if (room && socket.nickname === room.owner) {
            let sockets = io.sockets.adapter.rooms.get(data.roomName);
            let kickedSocket = null;
            for (let socketId of sockets) {
                let user = io.sockets.sockets.get(socketId).nickname;
                if (user == data.username) {
                    kickedSocket = io.sockets.sockets.get(socketId);
                }
            }

            console.log("found socket " + kickedSocket.nickname);

            kickedSocket.leave(kickedSocket.currentRoom);
            kickedSocket.currentRoom = "Default";
            kickedSocket.join(kickedSocket.currentRoom);
            io.emit('user_kicked', { username: data.username });
        }
        updateUsers();
    });

    const stream = require('stream');

    
    socket.on('image_message', async function(data) {
        console.log("Image received from: " + socket.nickname);
        
        // Create a readable stream from the received data
        const imageStream = stream.PassThrough();
        imageStream.end(data.image);
    
        // Create a writable stream to collect the image data
        const imageData = [];
    
        // Read the image data in chunks
        imageStream.on('data', (chunk) => {
            imageData.push(chunk);
        });
    
        // When the entire image is received, emit it to other clients
        imageStream.on('end', () => {
            const buffer = Buffer.concat(imageData);
            io.to(socket.currentRoom).emit("image_message_to_client", { 'image': buffer, 'username': data.username });
        });
    });


    socket.on('create_poll', function(data){
        let pollId = nextPollId++;
        polls[pollId] = {
            id: pollId,
            question: data.question,
            options: data.options,
            votes: new Array(data.options.length).fill(0),
            voters: new Set(), // Track voters to prevent multiple votes
            active: true // Poll is active when created
        };
        socket.emit('poll_created', polls[pollId]); // Emit to the creator for managing the poll
        socket.broadcast.emit('poll_created', { // Emit to others without manage options
            id: pollId,
            question: data.question,
            options: data.options
        });
    });
    
    socket.on('vote', function(data) { 
        let poll = polls[data.pollId];
        if (poll && poll.active && !poll.voters.has(socket.id)) {
            poll.votes[data.optionIndex]++;
            poll.voters.add(socket.id);
            io.emit('poll_updated', poll);
        }
    });
    
    socket.on('end_poll', function(pollId) {

        if (polls[pollId]) {
            polls[pollId].active = false;
            io.emit('poll_ended', polls[pollId]);
        }
    });   
});
