let username;

while (username == null) {
    username = prompt("Please enter a username:", "");
}

document.getElementById('buttonid').addEventListener('click', openDialog);

function openDialog() {
  document.getElementById('imageInput').click();
}

function vote(pollId, optionIndex) {
    socketio.emit('vote', { pollId: pollId, optionIndex: optionIndex });
}

document.getElementById('imageInput').onchange = function() {
    let fileInput = document.getElementById('imageInput');
    if (fileInput.files.length > 0) {
        var file = fileInput.files[0];
        // Check if the file is an image.
        if (file.type.match('image.*')) {
            const reader = new FileReader();
            reader.onload = function() {
                let arrayBuffer = new Uint8Array(reader.result);
                socketio.emit("image_message", {image: arrayBuffer, username: username});
            };
            reader.readAsArrayBuffer(file);
            console.log(username);
        } else {
            alert('Please select an image file.');
        }
    }
}


var socketio = io.connect();
socketio.emit("username", {'username': username});

socketio.on("userNameTaken", function(){
    while (username == null) {
        username = prompt("Username already in use, please try again:", "");
    }
    socketio.emit("username", {'username': username});
});

socketio.emit("get_rooms", {'username': username});

socketio.on("message_to_client", function (data) {
    //Append an HR thematic break and the escaped HTML of the new message
    console.log(data);
    let messageOut = document.createElement("p");
    messageOut.textContent = data['username'] + ": " + data['message'];
    document.getElementById("chatlog").prepend(messageOut);
});

socketio.on("image_message_to_client", function(data) {
    //Convert ArrayBuffer
    var blob = new Blob([data.image], { type: 'image/*' }); 
    var url = URL.createObjectURL(blob);

    let messageOut = document.createElement("p");
    messageOut.innerHTML = data.username + `:<br><img src="${url}" alt="Image" style="max-width:200px;">`;
    document.getElementById("chatlog").prepend(messageOut);
});

socketio.on("receive_private_message", function (data) {
    //Append an HR thematic break and the escaped HTML of the new message
    console.log(data);
    let messageOut = document.createElement("p");
    messageOut.textContent = "PM from " + data['from'] + ": " + data['message'];
    document.getElementById("chatlog").prepend(messageOut);
});

function sendMessage() {
    var msg = document.getElementById("message_input").value;
    socketio.emit("message_to_server", { 'username': username, 'message': msg });
}

function createRoom() {
    var roomName = null;
    while(!roomName){
        roomName = prompt("Enter Room Name:");
    }
    var isPrivate = confirm("Shall the room be private?");
    if (isPrivate) { 
        var password = prompt("Enter password: ");
    }
    socketio.emit("create_room", {roomName:roomName, isPrivate:isPrivate, password:password, username: username});
    updateChatroomTitle(roomName);
}

document.getElementById("roomadd").addEventListener("click", createRoom, false);

function displayRoom(data) {
    var roomList = document.getElementById("roomlist");
    var roomItem = document.createElement("li");
    roomItem.textContent = data.roomName;
    if(data.isPrivate){ 
        roomItem.textContent += " (Private)";
    }

    roomItem.addEventListener("click", function() {
        joinRoom(data.roomName, data.isPrivate);
    });

    let joinButton = document.createElement("button");
    joinButton.textContent = "Join";
    joinButton.addEventListener("click", function() {
        joinRoom(data.roomName, data.isPrivate);
    });

    roomItem.append(joinButton);

    roomList.append(roomItem);
}

socketio.on("room_created", function(data){
    displayRoom(data);

    if(data.creator == username) {
        joinRoom(data.roomName, data.isPrivate);
    }
});

socketio.on("rooms", function(data){
    let roomList = document.getElementById("roomlist");
    roomList.innerHTML = "";
    let header = document.createElement("h3");
    header.textContent = "Chat Rooms"
    roomList.append(header);
    for (const [key, value] of Object.entries(data.roomList)) {
        displayRoom(value);
    }
});

socketio.on("update_user_list", function(data) { 
    let userListElement = document.getElementById("userlist");
    userListElement.innerHTML = '';
    let userHeader = document.createElement("h3");
    userHeader.textContent = "User List:";
    userListElement.append(userHeader);

    let users = data.users;

    console.log(users);

    for (let i = 0; i < users.length; i++) {
        let userElement = document.createElement("li");
        userElement.textContent = users[i];

        if (users[i] !== username) { 
            let dmButton = document.createElement("button");
            dmButton.textContent = "DM";
            dmButton.onclick = function() {
                let message = prompt("Enter your private message:");
                if(message) {
                    socketio.emit('send_private_message', { targetUsername: users[i], message: message });
                    let messageOut = document.createElement("p");
                    messageOut.textContent = "PM to " + users[i] + ": " + message;
                    document.getElementById("chatlog").prepend(messageOut);
                }
            };
            userElement.appendChild(dmButton);
        }

        if (data.roomOwner === username && users[i] !== data.roomOwner) { 
            let kickButton = document.createElement("button");
            kickButton.textContent = "Kick";
            kickButton.onclick = function() {
                socketio.emit('kick_user', { roomName: data.currentRoom, username: users[i] });
                userElement.remove();
            };
            userElement.appendChild(kickButton);

            let banButton = document.createElement("button");
            banButton.textContent = "Ban";
            banButton.onclick = function() {
                socketio.emit('ban_user', { roomName: data.currentRoom, username: users[i] });
                userElement.remove();
            };
            userElement.appendChild(banButton);
        }
        userListElement.appendChild(userElement);
    }


});

socketio.on("error", function(data){
    alert(data.message);
});

socketio.on('user_banned', function(data) { 
    if(data.username === username) { 
        alert('You have been banned from the room.');
        joinRoom("Default", false);
        socketio.emit("get_rooms", {username: username});
    } else {
        socketio.emit("update_user_list");
    }
});

socketio.on('user_kicked', function(data) { 
    if(data.username === username) { 
        alert('You have been kicked from the room.');
        joinRoom("Default", false);
        //socketio.emit("get_rooms", {username: username});
    } else {
        socketio.emit("update_user_list");
    }
});

function updateChatroomTitle(roomName) {
    document.getElementById("chatroom-title").textContent = roomName;
}

function joinRoom(roomName, isPrivate) {
    //var password = isPrivate ? prompt("This room is private, please enter the password: ") : "";
    let password = "";
    if (isPrivate) {
        password = prompt("This room is private, please enter the password: ");
    }
    socketio.emit("join_room", {roomName: roomName, password: password, username: username});
    document.getElementById("chatlog").innerHTML = "";
    updateChatroomTitle(roomName);
}

document.getElementById('create-poll-button').addEventListener('click', function() {
    let question = prompt("What question would you like to ask?");
    let options = prompt("Enter your poll options separated by commas:").split(',');
    socketio.emit('create_poll', { question: question, options: options });
  });

socketio.on('poll_created', function(poll) {
    var pollElement = document.createElement('div');
    pollElement.id = 'poll_' + poll.id;
    pollElement.innerHTML = `<p>Poll: ${poll.question}</p>`;
    
    poll.options.forEach(function(option, index) {
        var button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', function() {
            vote(poll.id, index);
        });
        pollElement.appendChild(button);
    });

    document.getElementById('chatlog').prepend(pollElement);
    
    if (poll.active) {
        let endButton = document.createElement("button");
        endButton.id = "end-poll-button";
        endButton.textContent = "End Poll";
        let space = document.createElement("br");
        pollElement.appendChild(space);
        pollElement.appendChild(endButton);
        document.getElementById('end-poll-button').onclick = function() {
          socketio.emit('end_poll', poll.id);
        };
    }
});

socketio.on('poll_updated', function(poll) {
    var pollElement = document.getElementById('poll_' + poll.id);
    if (pollElement) {
      // Update the vote counts for each option
      poll.options.forEach(function(option, index) {
        var optionElement = pollElement.querySelector('.poll-option[data-option-id="' + option.id + '"]');
        if (optionElement) {
          var voteCountElement = optionElement.querySelector('.vote-count');
          voteCountElement.textContent = poll.votes[index] + ' votes';
        }
      });
    }
  });

  socketio.on('poll_ended', function(poll) {
    var pollElement = document.getElementById('poll_' + poll.id);
    if (pollElement) {
      // Update the poll status in the UI
      //let statusElement = pollElement.querySelector('.poll-status');
      pollElement.innerHTML = "";
      let endPoll = document.createElement("p");
      endPoll.textContent = "Poll has ended: " + poll.question;
      pollElement.appendChild(endPoll);

      poll.options.forEach(function(option, index) {
        var result = document.createElement('p');
        result.textContent = option + ': ' + poll.votes[index] + ' votes';
        pollElement.appendChild(result);
      });
    }
  });
