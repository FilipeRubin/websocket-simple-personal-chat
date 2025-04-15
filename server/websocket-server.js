const WebSocket = require('ws');
const webSocketServer = new WebSocket.Server({host: '0.0.0.0', port: 3001});

const users = [];
const usersSockets = new Map();
const callAttempts = new Map();
let lastUsedId = 0;

webSocketServer.on('connection', (clientSocket, request) => {
    const clientAddress = request.socket.remoteAddress;
    console.log(`Client "${clientAddress}" connected.`);
    const userObject = registerUser(clientSocket, clientAddress);

    updateUsersOnClients();

    clientSocket.on('message', (message) => {
        const messageObject = parseMessage(message.toString());
        if (messageObject != null)
        {
            dispatchMessageObject(messageObject, userObject);
        }
    });

    clientSocket.on('close', () => {
        console.log(`Client "${clientAddress}" disconnected.`);
        handleUserDisconnection(userObject);
        unregisterUser(userObject);
        updateUsersOnClients();
    });
});

console.log(`The server is running...`);

function sendMessage(clientSocket, type, data)
{
    const messageObject = {
        type: type,
        data: data
    };
    const messageString = JSON.stringify(messageObject);

    if (clientSocket != undefined)
    {
        clientSocket.send(messageString);
    }
}

function sendMessageToAll(type, data)
{
    webSocketServer.clients.forEach((client) => {
        sendMessage(client, type, data);
    });
}

function updateUsersOnClients()
{
    const usersString = JSON.stringify(users);
    sendMessageToAll('users', usersString);
}

function attemptToCallUser(caller, callee)
{
    // Check if some of those are null, return early if true
    if (caller == null || callee == null)
    {
        return;
    }

    // Check if caller and callee are different users (get boolean value)
    const areDifferentUsers = caller.uniqueId != callee.uniqueId;

    // Tell the caller that it is allowed to call (if said boolean is true)
    const canCallerCallCallee = areDifferentUsers && caller.status == 'connected' && callee.status == 'connected';

    if (canCallerCallCallee)
    {
        sendMessage(usersSockets.get(caller), 'call-request-permission', JSON.stringify(callee));
    }

    // If said boolean is false, return here
    if (!canCallerCallCallee)
    {
        return;
    }

    // Tell the callee that someone is distur... CALLING it...
    sendMessage(usersSockets.get(callee), 'user-call', JSON.stringify(caller));

    callAttempts.set(caller, callee);
}

function cancelCallAttempt(caller)
{
    // Tell the caller it's okay for him to consider itself "connected" again (and can close the call screen)
    if (caller.status === 'calling')
    {
        sendMessage(usersSockets.get(caller), 'call-cancel-request-permission', null);
    }

    // Tell the callee that it should delete the call pop-up that showed up on its screen
    const callee = callAttempts.get(caller) || null;

    if (callee != null)
    {
        sendMessage(usersSockets.get(callee), 'user-call-cancel', JSON.stringify(caller));
        callAttempts.delete(caller);
    }
}

function cancelAllCallAttemptsTo(user)
{
    const callersToCancel = [];

    callAttempts.forEach((callee, caller) => {
        if (callee.uniqueId === user.uniqueId)
        {
            callersToCancel.push(caller);
        }
    });

    callersToCancel.forEach((caller) => {
        cancelCallAttempt(caller);
    });
}

function acceptCallAttempt(callerUniqueId, calleeUniqueId)
{
    const caller = getUserByUniqueId(callerUniqueId);
    const callee = getUserByUniqueId(calleeUniqueId);
    
    cancelAllCallAttemptsTo(caller);
    cancelAllCallAttemptsTo(callee);

    startCall(caller, callee);
}

function registerUser(socket, userAddress)
{
    const userObject = {
        uniqueId: lastUsedId,
        name: "",
        address: userAddress,
        status: ""
    };
    users.push(userObject);
    usersSockets.set(userObject, socket);
    lastUsedId++;
    return userObject;
}

function unregisterUser(user)
{
    const index = users.indexOf(user);
    if (index != -1)
    {
        usersSockets.delete(user);
        users.splice(index, 1);
    }
}

function handleUserDisconnection(user)
{
    const callAttemptToCancel = callAttempts.get(user) || null;
    if (callAttemptToCancel != null)
    {
        cancelCallAttempt(user);
    }

    cancelAllCallAttemptsTo(user);
}

function startCall(userA, userB)
{
    const socketA = usersSockets.get(userA);
    const socketB = usersSockets.get(userB);
    sendMessage(socketA, 'start-call', JSON.stringify(userB));
    sendMessage(socketB, 'start-call', JSON.stringify(userA));
}

function getUserByUniqueId(uniqueId)
{
    return users.find(user => user.uniqueId === uniqueId) || null;
}

function parseMessage(message)
{
    try
    {
        const messageObject = JSON.parse(message);

        if (messageObject.type === undefined || messageObject.data === undefined)
        {
            return null;
        }

        return messageObject;
    }
    catch (error)
    {
        console.error(`Failed to parse message: ${error}\nMessage text: ${message}`);
        return null;
    }
}

function dispatchMessageObject(messageObject, senderUserObject)
{
    switch (messageObject.type)
    {
    case 'update-status':
        senderUserObject.status = messageObject.data;
        updateUsersOnClients();
        break;
    case 'name-change':
        senderUserObject.name = messageObject.data;
        updateUsersOnClients();
        break;
    case 'call-request':
        attemptToCallUser(senderUserObject, getUserByUniqueId(messageObject.data));
        break;
    case 'call-cancel-request':
        cancelCallAttempt(senderUserObject);
        break;
    case 'user-call-accept':
        acceptCallAttempt(messageObject.data, senderUserObject.uniqueId);
        break;
    case 'user-call-decline':
        cancelCallAttempt(getUserByUniqueId(messageObject.data));
        break;
    default:
        return;
    }
}
