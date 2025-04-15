class VoiceCall
{
    static onEnd = function(){};

    static async createCall()
    {
        const peerConfiguration = {iceServers: [{ urls: 'stun:stun.l.google.com:19302' },]};
        const peer = new RTCPeerConnection(peerConfiguration); // Creates a peer that will be able to connect using the ICE server specified above

        const sessionDescription = await peer.createOffer(); // Basically fetches and returns the details for a session to be able to be established
        peer.setLocalDescription(sessionDescription); // Tells the peer the details of the session
    }

    static joinCall(sessionDescription)
    {

    }

    static end()
    {
        this.onEnd();
    }
}