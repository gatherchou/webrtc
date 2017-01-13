function _assert(desc, v) {
  if (v) {
    return;
  }
  else {
    let caller = _assert.caller || 'Top level';
    console.error('ASSERT in %s, %s is :', caller, desc, v);
  }
}

var socket = io();
var $window = $(window);
var $loginPage = $('.login');
var $chatPage = $('.app');
var $usernameInput = $('.usernameInput');
var $userLists = $('.listBody');
var $inputMessage = $('.inputMessage');
var $messages = $('.msgs');
var $currentInput = $usernameInput.focus();
var $chatArea = $(".chatArea");
var $container = $("#container");

var username;
var connected = false;
var sw = false;

let localVideo = document.getElementById('local_video');
let localStream = null;
let peerConnections = [];
let remoteVideos = [];
let room = getRoomName();
const MAX_CONNECTION_COUNT = 5;

// --- multi video ---
let container = document.getElementById('container');
_assert('container', container);

// --- prefix -----
navigator.getUserMedia  = navigator.getUserMedia    || navigator.webkitGetUserMedia ||
navigator.mozGetUserMedia || navigator.msGetUserMedia;
RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;



socket.on('flash userLists', function (data){
  connected = true;
  $userLists.empty();
  for(var i in data){
    $userLists.append($('<li>').text(data[i]));
  }
});

// Whenever the server emits 'new message', update the chat body
socket.on('new message', function (data) {
  postMsg(data.username, data.message);
});

socket.on('connect', function(evt) {
  socket.emit('enter', room);
});

socket.on('message', function(message) {
  let fromId = message.from;

  if (message.type === 'offer') {
    // -- got offer ---
    let offer = new RTCSessionDescription(message);
    setOffer(fromId, offer);
    console.log(offer.toString());
  }
  else if (message.type === 'answer') {
    // --- got answer ---
    let answer = new RTCSessionDescription(message);
    setAnswer(fromId, answer);
    console.log("answer : " + answer);
  }
  else if (message.type === 'candidate') {
    // --- got ICE candidate ---
    let candidate = new RTCIceCandidate(message.ice);
    addIceCandidate(fromId, candidate);
  }
  else if (message.type === 'call me') {
    if (! isReadyToConnect()) {
      console.log('Not ready to connect, so ignore');
      return;
    }
    else if (! canConnectMore()) {
      console.warn('TOO MANY connections, so ignore');
    }

    if (isConnectedWith(fromId)) {
      // already connnected, so skip
      console.log('already connected, so ignore');
    }
    else {
      // connect new party
      makeOffer(fromId);
    }
  }
  else if (message.type === 'bye') {
    if (isConnectedWith(fromId)) {
      stopConnection(fromId);
    }
  }
});

socket.on('user disconnected', function(evt) {
  let id = evt.id;
  if (isConnectedWith(id)) {
    stopConnection(id);
  }
});

// --- broadcast message to all members in room
function emitRoom(msg) {
  socket.emit('message', msg);
}

function emitTo(id, msg) {
  msg.sendto = id;
  socket.emit('message', msg);
}

function getRoomName() { 
  let url = $(location)[0].href;//document.location.href;
  let args = url.split('?');
  if (args.length > 1) {
    let room = args[1];
    if (room != '') {
      return room;
    }
  }
  return '_testroom';
}

// ---- for multi party -----
function isReadyToConnect() {
  if (localStream) {
    return true;
  }
  else {
    return false;
  }
}

// --- RTCPeerConnections ---
function getConnectionCount() {
  return peerConnections.length;
}

function canConnectMore() {
  return (getConnectionCount() < MAX_CONNECTION_COUNT);
}

function isConnectedWith(id) {
  if (peerConnections[id])  {
    return true;
  }
  else {
    return false;
  }
}

function addConnection(id, peer) {
  _assert('addConnection() peer', peer);
  _assert('addConnection() peer must NOT EXIST', (! peerConnections[id]));
  peerConnections[id] = peer;
}

function getConnection(id) {
  let peer = peerConnections[id];
  _assert('getConnection() peer must exist', peer);
  return peer;
}

function deleteConnection(id) {
  _assert('deleteConnection() peer must exist', peerConnections[id]);
  delete peerConnections[id];
}

function stopConnection(id) {
  detachVideo(id);

  if (isConnectedWith(id)) {
    let peer = getConnection(id);
    peer.close();
    deleteConnection(id);
  }
}

function stopAllConnection() {
  for (let id in peerConnections) {
    stopConnection(id);
  }
}

// --- video elements ---
function attachVideo(id, stream) {
  let video = addRemoteVideoElement(id);
  playVideo(video, stream);
  video.volume = 1.0;
}

function detachVideo(id) {
  let video = getRemoteVideoElement(id);
  pauseVideo(video);
  deleteRemoteVideoElement(id);
}

function isRemoteVideoAttached(id) {
  if (remoteVideos[id]) {
    return true;
  }
  else {
    return false;
  }
}

function addRemoteVideoElement(id) {
  _assert('addRemoteVideoElement() video must NOT EXIST', (! remoteVideos[id]));
  let video = createVideoElement('remote_video_' + id);
  remoteVideos[id] = video;
  return video;
}

function getRemoteVideoElement(id) {
  let video = remoteVideos[id];
  _assert('getRemoteVideoElement() video must exist', video);
  return video;
}

function deleteRemoteVideoElement(id) {
  _assert('deleteRemoteVideoElement() stream must exist', remoteVideos[id]);
  removeVideoElement('remote_video_' + id);
  delete remoteVideos[id];
}

function createVideoElement(elementId) {
  let video = document.createElement('video');
  video.id = elementId;
  video.setAttribute('style', "width: 480px;height: 360px;position: relative;float: left;margin-top: 1%;margin-left: 1%;");
  video.setAttribute("onclick", "toggle(event)");

  container.appendChild(video);

  return video;
}

function removeVideoElement(elementId) {
  let video = document.getElementById(elementId);
  _assert('removeVideoElement() video must exist', video);

  container.removeChild(video);
  return video;
}

// ---------------------- media handling ----------------------- 
// start local video
function startVideo() {
    getDeviceStream({video: true, audio: false}) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
    .then(function (stream) { // success
      localStream = stream;
      playVideo(localVideo, stream);
    }).catch(function (error) { // error
      console.error('getUserMedia error:', error);
      return;
    });

    localVideo.style.cssText="width: 360px;height: 240px;position: fixed;bottom: 36%;right:0";
  }

  function stopLocalStream(stream) {
    let tracks = stream.getTracks();
    if (! tracks) {
      console.warn('NO tracks');
      return;
    }

    for (let track of tracks) {
      track.stop();
    }
  }

  function getDeviceStream(option) {
    if ('getUserMedia' in navigator.mediaDevices) {
      return navigator.mediaDevices.getUserMedia(option);
    }
    else {
      return new Promise(function(resolve, reject){    
        navigator.getUserMedia(option,
          resolve,
          reject
          );
      });      
    }
  }

  function playVideo(element, stream) {
    if ('srcObject' in element) {
      element.srcObject = stream;
    }
    else {
      element.src = window.URL.createObjectURL(stream);
    }
    element.play();
    element.volume = 0;
  }

  function pauseVideo(element) {
    element.pause();
    if ('srcObject' in element) {
      element.srcObject = null;
    }
    else {
      if (element.src && (element.src !== '') ) {
        window.URL.revokeObjectURL(element.src);
      }
      element.src = '';
    }
  }

  function sendSdp(id, sessionDescription) {
    let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
    emitTo(id, message);
    // console.log("sdp : " + message.sdp)
  }

  function sendIceCandidate(id, candidate) {
    let obj = { type: 'candidate', ice: candidate };
    emitTo(id, obj);
  }

// ---------------------- connection handling -----------------------
function prepareNewConnection(id) {

  let pc_config = {"iceServers":[]};
  let peer = new RTCPeerConnection(pc_config);

  // --- on get remote stream ---
  if ('ontrack' in peer) {
    peer.ontrack = function(event) {
      let stream = event.streams[0];
      console.log('-- peer.ontrack() stream.id=' + stream.id);
      if (isRemoteVideoAttached(id)) {
        console.log('stream already attached, so ignore');
      }
      else {
        attachVideo(id, stream);
      }
    };
  }
  else {
    peer.onaddstream = function(event) {
      let stream = event.stream;
      attachVideo(id, stream);
    };
  }

  // --- on get local ICE candidate
  peer.onicecandidate = function (evt) {
    if (evt.candidate) {
      sendIceCandidate(id, evt.candidate);
    }
    else {
      console.log('empty ice event');
    }
  };

  // --- when need to exchange SDP ---
  peer.onnegotiationneeded = function(evt) {
    console.log('-- onnegotiationneeded() ---');
  };

  // --- other events ----
  peer.onicecandidateerror = function (evt) {
    console.error('ICE candidate ERROR:', evt);
  };

  peer.onsignalingstatechange = function() {
    console.log('== signaling status=' + peer.signalingState);
  };

  peer.oniceconnectionstatechange = function() {
    if (peer.iceConnectionState === 'disconnected') {
      stopConnection(id);
    }
  };

  peer.onicegatheringstatechange = function() {
    console.log('==***== ice gathering state=' + peer.iceGatheringState);
  };

  peer.onconnectionstatechange = function() {
    console.log('==***== connection state=' + peer.connectionState);
  };

  peer.onremovestream = function(event) {
    deleteRemoteStream(id);
    detachVideo(id);
  };

  // -- add local stream --
  if (localStream) {
    peer.addStream(localStream);
  }
  else {
    console.warn('no local stream, but continue.');
  }

  return peer;
}

function makeOffer(id) {
  _assert('makeOffer must not connected yet', (! isConnectedWith(id)) );
  peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection.createOffer().then(function (sessionDescription) {
    sessionDescription.sdp = setBandwidth(sessionDescription.sdp);
    return peerConnection.setLocalDescription(sessionDescription);
  }).then(function() {
    sendSdp(id, peerConnection.localDescription);
  }).catch(function(err) {
    console.error(err);
  });
}

function setOffer(id, sessionDescription) {
  _assert('setOffer must not connected yet', (! isConnectedWith(id)) );    
  let peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection.setRemoteDescription(sessionDescription).then(function() {
    makeAnswer(id);
  }).catch(function(err) {
    console.error('setRemoteDescription(offer) ERROR: ', err);
  });
}

function makeAnswer(id) {
  let peerConnection = getConnection(id);
  if (! peerConnection) {
    console.error('peerConnection NOT exist!');
    return;
  }

  peerConnection.createAnswer().then(function (sessionDescription) {
    sessionDescription.sdp = setBandwidth(sessionDescription.sdp);
    return peerConnection.setLocalDescription(sessionDescription);
  }).then(function() {
    sendSdp(id, peerConnection.localDescription);
  }).catch(function(err) {
    console.error(err);
  });
}

function setAnswer(id, sessionDescription) {
  let peerConnection = getConnection(id);
  if (! peerConnection) {
    console.error('peerConnection NOT exist!');
    return;
  }

  peerConnection.setRemoteDescription(sessionDescription).then(function() {
    console.log('setRemoteDescription(answer) succsess in promise');
  }).catch(function(err) {
    console.error('setRemoteDescription(answer) ERROR: ', err);
  });
}

// --- tricke ICE ---
function addIceCandidate(id, candidate) {
  let peerConnection = getConnection(id);
  if (peerConnection) {
    peerConnection.addIceCandidate(candidate);
  }
  else {
    console.error('PeerConnection not exist!');
    return;
  }
}

// start PeerConnection
function connect() {
  if (! isReadyToConnect()) {
    console.warn('NOT READY to connect');
  }
  else if (! canConnectMore()) {
    console.log('TOO MANY connections');
  }
  else {
    callMe();
  }
}

// close PeerConnection
function hangUp() {
  emitRoom({ type: 'bye' });  
  stopAllConnection();
}

// ---- multi party --
function callMe() {
  emitRoom({type: 'call me'});
}





//----------socket chat----------
$window.keydown(function (event){
  // Auto-focus the current input when a key is typed
  if (!(event.ctrlKey || event.metaKey || event.altKey)) {
    $currentInput.focus();
  }
  // When the client hits ENTER on their keyboard
  if (event.which === 13) {
    if (username) {
      sendMessage();
    } 
    else {
      setUsername();
      startVideo();
    }
  }
})

// Sets the client's username
function setUsername () {
  username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

// Sends a chat message
function sendMessage () {
  var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      postMsg(username, message);
        // tell server to execute 'new message' and send along one parameter
        socket.emit('new message', message);
      }
    }

// Prevents input from having injected markup
function cleanInput (input) {
  return $('<div>').text(input).text();
}


function toggle(event) {
  if(sw == false){
    sw = true;
    fullScreen(event);
  }
  else{
    sw = false;
    defaultScreen(event);
  }
}

function fullScreen(event) {
  var target = event.target;

  $chatArea.css("display", "none");
  $container.css({"height": "100%", "bottom":"0"});

  target.style.cssText = "position: absolute;object-fit: cover;width: 100%;height: 100%;max-width: 100%;max-height: 100%;top:0; left:0;z-index: 1; margin: 0";
}

function defaultScreen(event) {
  var target = event.target;

  $chatArea.css("display", "inline")
  $container.css({"height": "61%", "bottom":"35%"});

  target.style.cssText = "width: 480px;height: 360px;relative: relative;z-index: 0;margin-top: 1%;margin-left: 1%;"
}

function setBandwidth(sdp) {
  var videoBandwidth = 20000;

  sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + videoBandwidth + '\r\n');

  return sdp;
}

function chatHistory() {
  window.open(window.location.href+"history");
}