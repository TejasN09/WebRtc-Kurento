const express = require('express');
const app = express();
const http = require('http').Server(app);
const minimist = require('minimist');
const io = require('socket.io')(http);
const kurento = require('kurento-client');

const argv = minimist(process.argv.slice(2), {
    default: {
        as_uri: 'http://localhost:3000',
        ws_uri: 'ws://localhost:8888/kurento'
    }
});

let kurentoClient = null;
const iceCandidateQueues = {};

io.on('connection', socket => {
    console.log("Socket client created!");
    socket.on('message', message => {
        console.log("Received message:", message);
        switch (message.event) {
            case 'joinRoom':
                joinRoom(socket, message.userName, message.roomName);
                break;
            case 'receiveVideoFrom':
                receiveVideoFrom(socket, message.userid, message.roomName, message.sdpOffer);
                break;
            case 'candidate':
                addIceCandidate(socket, message.userid, message.roomName, message.candidate);
                break;
        }
    });
});

async function joinRoom(socket, username, roomname) {
    try {
        const myRoom = await getRoom(socket, roomname);
        const outgoingMedia = await myRoom.pipeline.create('WebRtcEndpoint');
        const user = {
            id: socket.id,
            name: username,
            outgoingMedia: outgoingMedia,
            incomingMedia: {}
        };

        const icecandidateQueue = iceCandidateQueues[user.id];
        if (icecandidateQueue) {
            icecandidateQueue.forEach(ice => user.outgoingMedia.addIceCandidate(ice.candidate));
            delete iceCandidateQueues[user.id];
        }

        user.outgoingMedia.on('IceCandidateFound', event => {
            if (event.candidate) {
                socket.emit('message', {
                    event: 'candidate',
                    userid: user.id,
                    candidate: event.candidate
                });
            }
        });

        socket.to(roomname).emit('message', {
            event: 'newParticipantArrived',
            userid: user.id,
            username: user.name
        });

        const existingUsers = Object.values(myRoom.participants).filter(participant => participant.id !== user.id);
        socket.emit('message', {
            event: 'existingParticipants',
            existingUsers,
            userid: user.id
        });

        myRoom.participants[user.id] = user;

        if (existingUsers.length === 0) {
            existingUsers.forEach(existingUser => {
                existingUser.outgoingMedia.connect(user.incomingMedia[existingUser.id]);
            });
        } else {
            const initiator = existingUsers[0];
            const initiatorIncomingMedia = initiator.incomingMedia[user.id];
            user.outgoingMedia.connect(initiatorIncomingMedia);
        }
    } catch (err) {
        console.error("Error occurred while joining room:", err);
    }
}

async function getRoom(socket, roomname) {
    let myRoom = io.sockets.adapter.rooms.get(roomname) || { length: 0 };

    let numClients = myRoom.length;

    if (numClients === 0) {
        console.log("// Room created for the first user");
        socket.join(roomname);
        myRoom = io.sockets.adapter.rooms.get(roomname);

        try {
            await getKurentoClient();
            myRoom.pipeline = await kurentoClient.create('MediaPipeline');
            myRoom.participants = {};
        } catch (err) {
            console.error("Error occurred while creating room:", err);
            throw err;
        }

        return myRoom;
    } else {
        socket.join(roomname);
        return myRoom;
    }
}

async function getKurentoClient() {
    if (kurentoClient !== null)
        return null;
    try {
        kurentoClient = await kurento(argv.ws_uri);
        return null;
    } catch (error) {
        console.error("Error occurred while creating Kurento client:", error);
        throw error;
    }
}

async function receiveVideoFrom(socket, userid, roomName, sdpOffer) {
    try {
        const endpoint = await getEndpointForUser(socket, roomName, userid);
        const answerSdp = await endpoint.processOffer(sdpOffer);

        socket.emit('message', {
            event: "receiveVideoAnswer",
            senderid: userid,
            sdpAnswer: answerSdp
        });

        endpoint.gatherCandidates(err => {
            if (err) console.error("Error occurred while gathering candidates:", err);
        });
    } catch (err) {
        console.error("Error occurred while receiving video from:", err);
    }
}

async function getEndpointForUser(socket, roomname, senderid) {
    const myRoom = io.sockets.adapter.rooms.get(roomname);
    const asker = myRoom.participants[socket.id];
    const sender = myRoom.participants[senderid];

    if (asker.id === sender.id) {
        return asker.outgoingMedia;
    }

    if (asker.incomingMedia[sender.id]) {
        sender.outgoingMedia.connect(asker.incomingMedia[sender.id], err => {
            if (err) throw err;
        });
        return asker.incomingMedia[sender.id];
    } else {
        try {
            const incomingMedia = await myRoom.pipeline.create('WebRtcEndpoint');
            asker.incomingMedia[sender.id] = incomingMedia;

            const icecandidateQueue = iceCandidateQueues[sender.id];
            if (icecandidateQueue) {
                icecandidateQueue.forEach(ice => incomingMedia.addIceCandidate(ice.candidate));
            }

            incomingMedia.on('IceCandidateFound', event => {
                if (event.candidate) {
                    socket.emit('message', {
                        event: 'candidate',
                        userid: sender.id,
                        candidate: event.candidate
                    });
                }
            });

            sender.outgoingMedia.connect(incomingMedia);
            return incomingMedia;
        } catch (e) {
            console.error("Error occurred while creating incoming media client:", e);
            throw e;
        }
    }
}

function addIceCandidate(socket, senderid, roomName, iceCandidate) {
    const myRoom = io.sockets.adapter.rooms.get(roomName);
    const user = myRoom ? myRoom.participants[socket.id] : null;
    if (user != null) {
        const candidate = kurento.register.complexTypes.IceCandidate(iceCandidate);
        if (senderid === user.id) {
            if (user.outgoingMedia) {
                user.outgoingMedia.addIceCandidate(candidate);
            } else {
                if (!iceCandidateQueues[user.id]) {
                    iceCandidateQueues[user.id] = [];
                }
                iceCandidateQueues[user.id].push({ candidate: candidate });
            }
        } else {
            if (user.incomingMedia[senderid]) {
                user.incomingMedia[senderid].addIceCandidate(candidate);
            } else {
                if (!iceCandidateQueues[senderid]) {
                    iceCandidateQueues[senderid] = [];
                }
                iceCandidateQueues[senderid].push({
                    candidate: candidate
                });
            }
        }
    }
}

app.use(express.static('public'));

http.listen(3000, () => {
    console.log('App is running at port 3000');
});
