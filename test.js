class Room {
    constructor(username, title, private) {
        this.owner = username;
        this.title = title;
        this.banList = [];
        this.userList = [];
        this.isPrivate = private;
        this.password;
    }
    addUser(username) {
        this.userList.push(username);
    }
    banUser(username) {
        this.banList.push(username);
    }
    removeUser(username) {
        const index = this.userList.indexOf(username);
        const result = myArray.splice(index, 1);
    }
    setPassword(password) {
        this.password = password;
    }
}

// maybe store values in user object?

// bare minimum to make a room: owner name, title, private