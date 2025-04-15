// Next step: implement a "being called" screen
// A new "being called" pop-up will be dynamically created for each incoming call request with an "accept" and "decline" button
// When the user clicks "decline", it will send to the server that the user does not want to talk with the caller, and the calling request shall be cancelled
// When the user clicks "accept", every call request except the accepted one shall be cancelled just like the example above
// Also when accepting a call, the user should enter the "on call" state, in which other users cannot call it anymore
// When in "on call", a new screen should appear with a "hang up" button which leads to both cancelling the call
//

let webSocket = null;
let connectionStatus = '';

const callers = new Map();

document.addEventListener('DOMContentLoaded', () => { // First steps here
    setConnectionStatus('offline');
    connectToServer('ws://localhost:3001');
});

function connectToServer(address)
{
    webSocket = new WebSocket(address);
    
    setConnectionStatus('connecting');

    webSocket.onopen = () => {
        setConnectionStatus('connected');
    };

    webSocket.onmessage = (message) => {
        const messageObject = parseMessage(message.data);
        dispatchMessageObject(messageObject);
    };

    webSocket.onerror = (error) => {

    };

    webSocket.onclose = () => {
        setConnectionStatus('offline');
    };
}

function parseMessage(message)
{
    const messageObject = JSON.parse(message);

    if (messageObject.type === undefined || messageObject.data === undefined)
    {
        return null;
    }

    switch (messageObject.type)
    {
    case 'users':
    case 'call-request-permission':
    case 'user-call':
    case 'user-call-cancel':
    case 'start-call':
        messageObject.data = JSON.parse(messageObject.data);
        break;
    }

    return messageObject;
}

function dispatchMessageObject(messageObject)
{
    switch (messageObject.type)
    {
    case 'users':
        onReceiveUsers(messageObject.data)
        break;
    case 'call-request-permission':
        onCallUserAuthorized(messageObject.data);
        break;
    case 'call-cancel-request-permission':
        setConnectionStatus('connected');
        break;
    case 'user-call':
        createCallPopUp(messageObject.data);
        break;
    case 'user-call-cancel':
        destroyCallPopUp(messageObject.data);
        break;
    case 'start-call':
        startCallWithUser(messageObject.data);
        break;
    default:
        return;
    }
}

function updateName()
{
    const nameInputElement = document.getElementById('name-input');
    const newName = nameInputElement.value;
    nameInputElement.value = '';

    sendMessageToServer('name-change', newName);
}

function requestToCallUser(userUniqueId)
{
    sendMessageToServer('call-request', userUniqueId);
}

function onCallUserAuthorized(user)
{
    setConnectionStatus('calling', getUserName(user));
}

function cancelCallingUser()
{
    sendMessageToServer('call-cancel-request', null);
}

function onCallCancelled()
{
    setConnectionStatus('connected');
}

function onReceiveUsers(users)
{
    clearUsersList();

    users.forEach((user) => {
        addUserToList(user);
    });
}

function clearUsersList()
{
    const usersListElement = document.getElementById('users-list');
    usersListElement.innerText = '';
}

function addUserToList(user)
{
    const listItemElement = document.createElement('li');
    listItemElement.innerHTML = `<a href="#" onclick=requestToCallUser(${user.uniqueId})>${getUserName(user)} (${getFormattedUserStatus(user)})</a>`;
    const usersListElement = document.getElementById('users-list');
    usersListElement.appendChild(listItemElement);
}

function setConnectionStatus(newStatus, params = null)
{
    connectionStatus = newStatus;

    const statusElement = document.getElementById('status');
    const onlineElement = document.getElementById('online');
    const usersElement = document.getElementById('users');
    const callingUserElement = document.getElementById('calling-user');
    const callersElement = document.getElementById('callers');
    const updateNameElement = document.getElementById('update-name');
    const inCallElement = document.getElementById('in-call');
    
    switch (connectionStatus)
    {
    case 'offline':
        statusElement.innerText = 'Status: Offline 💀';
        break;
    case 'connecting':
        statusElement.innerText = 'Status: Connecting... 🤔';
        break;
    case 'connected':
        statusElement.innerText = 'Status: Connected to server 😀';
        break;
    case 'calling':
        statusElement.innerText = (typeof params === 'string') ? `Status: Calling ${params}... 🤭` : 'Status: Calling another user... 🤭'
        break;
    case 'in-call':
        statusElement.innerText = (typeof params === 'string') ? `Status: In a call with ${params} 🤩` : 'Status: In a call 🤩';
        break;
    default:
        connectionStatus = '';
        statusElement.innerText = 'Status: Unknown (Where am I?) 🤕';
    }

    const isConnected = connectionStatus === 'connected';
    const isCalling = connectionStatus === 'calling';
    const isInCall = connectionStatus === 'in-call';
    const isOnline = isConnected || isCalling || isInCall;

    callingUserElement.style.visibility = isCalling   ? 'visible' : 'hidden';
          usersElement.style.visibility = isConnected ? 'visible' : 'hidden';
        callersElement.style.visibility = isConnected ? 'visible' : 'hidden';
         onlineElement.style.visibility = isOnline    ? 'visible' : 'hidden';
     updateNameElement.style.visibility = isConnected ? 'visible' : 'hidden';
         inCallElement.style.visibility = isInCall    ? 'visible' : 'hidden';

    sendMessageToServer('update-status', connectionStatus);
}

function sendMessageToServer(type, data)
{
    if (webSocket != null && webSocket.readyState === WebSocket.OPEN)
    {
        const messageObject = {
            type: type,
            data: data
        };
        const messageAsString = JSON.stringify(messageObject);
        webSocket.send(messageAsString);
    }
}

function getUserName(user)
{
    return user.name != '' ? user.name : user.address;
}

function getFormattedUserStatus(user)
{
    switch (user.status)
    {
    case 'in-call':
        return 'in call';
    default:
        return user.status;
    }
}

function createCallPopUp(caller)
{
    const callersElement = document.getElementById('callers');
    const newCallerElement = document.createElement('div');
    newCallerElement.innerHTML = `<h4>You are being called by ${getUserName(caller)}</h4></br><button onclick=acceptCall(${caller.uniqueId})>Accept🥰</button><button onclick=declineCall(${caller.uniqueId})>Decline😠</button>`
    callersElement.appendChild(newCallerElement);
    callers.set(caller.uniqueId, newCallerElement);
}

function destroyCallPopUp(caller)
{
    const callerElement = callers.get(caller.uniqueId) || null;
    if (callerElement != null)
    {
        callerElement.remove();
        callers.delete(caller);
    }
}

function acceptCall(callerUniqueId)
{
    sendMessageToServer('user-call-accept', callerUniqueId);
}

function declineCall(callerUniqueId)
{
    sendMessageToServer('user-call-decline', callerUniqueId);
}

function startCallWithUser(user)
{
    setConnectionStatus('in-call', getUserName(user));
    VoiceCall.createCall(null);
}

function endCall()
{
    setConnectionStatus('connected');
}
