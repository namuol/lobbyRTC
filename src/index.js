import 'babel/polyfill';

import EventEmitter from 'events';
import Peer from 'peerjs';

let requiredOpts = {
  'APIKey': 'string',
};

function claimLobbyRole (opts) {
  let {APIKey} = opts;

  return new Promise(function (resolve, reject) {
    console.log('Attempting to claim the lobby role...');

    let peer = new Peer('LOBBY', {key: APIKey});

    peer.on('error', (err) => {
      peer.destroy();
      reject(new Error(`Could not assume lobby role: ${err.type}`));
    });

    peer.on('open', (id) => {
      console.log('Connection with peer server established...');
      if (id === 'LOBBY') {
        console.log('We have assumed the Lobby role!');
        resolve(peer);
      } else {
        peer.destroy();
        reject(new Error('Lobby role must already be taken.'));
      }
    });
  });
}

async function getLobbyConnection (opts) {
  let {APIKey} = opts;

  return new Promise(function (resolve, reject) {
    let peer = new Peer({key: APIKey});

    console.log('Attempting to connect with the lobby...');

    let connection = peer.connect('LOBBY');

    peer.on('error', (err) => {
      peer.destroy();
      reject(new Error(`Unexpected error; type: ${err.type}`));
    });

    connection.on('error', (err) => {
      peer.destroy();
      reject(new Error(`Unexpected error; type: ${err.type}`));
    });

    connection.on('open', () => {
      console.log('Connected with the lobby!');
      resolve([peer, connection]);
    });
  });
}

async function LobbyRTC (opts={}) {
  Object.keys(requiredOpts).forEach(function (opt) {
    if ((typeof opts[opt]) !== requiredOpts[opt]) {
      throw new TypeError(`Option "${opt}" was invalid type: ${requiredOpts[opt]}`);
    }
  });

  let API = new EventEmitter;

  let peer;
  let lobbyPeer;
  let lobbyConnection;
  let lobbyState = {
    channels: {},
  };

  function createChannel (opts) {
    let {peerID, data} = opts;
    
    if (lobbyState.channels[peerID]) {
      console.error(`Lobby role: Channel with ID "${peerID}" already exists; aborting!`);
      return;
    }

    lobbyState.channels[peerID] = {
      meta: {
        peers: 1,
        id: peerID,
      },
      data: data,
    };
  }

  function joinChannel (opts) {
    let {channelID} = opts;
    let channel = lobbyState.channels[channelID];
    if (!channel) {
      console.error('Lobby role: Could not find channel with ID:', channelID);
      return;
    }
    channel.meta.peers += 1;
  }

  try {
    peer = lobbyPeer = await claimLobbyRole(opts);
    
    let connections = {};
    
    let onChange = () => {
      API.emit('change', lobbyState);

      Object.keys(connections).forEach((_connectionLabel) => {
        connections[_connectionLabel].send(lobbyState);
      });
    };

    lobbyPeer.on('connection', (connection) => {
      console.log('Lobby role: new peer connected', connection);
      let connectionLabel = connection.label;
      let peerID = connection.peer;

      let handlers = {
        createChannel: (msg) => {
          createChannel({
            peerID: peerID,
            data: msg.data,
          });
        },

        joinChannel: (msg) => {
          joinChannel(msg);
        },

        leaveChannel: (msg) => {
          let channel = lobbyState.channels[id];
          if (!channel) {
            console.error('Lobby role: Could not find channel with ID', id);
            return;
          }
          channel.meta.peers -= 1;
        },
      };

      connections[connectionLabel] = connection;
      connection.on('open', () => {
        connection.send(lobbyState);
      });

      connection.on('data', (msg) => {
        console.log('Lobby role: got message:', msg);
        let handler = handlers[msg.type];

        if (!handler) {
          console.error('Lobby role: Unexpected incoming message type: ', msg.type);
          console.info('Lobby role: These are the valid message types: ', Object.keys(handlers));
          return;
        }

        handler(msg);

        onChange();
      });

      connection.on('error', (err) => {
        console.error('Lobby role: Unexpected error from connection', err);
        connection.close();
      });

      connection.on('close', () => {
        console.warn('Lobby role: Connection closed', connection);
        delete connections[connectionLabel];
        delete lobbyState.channels[peerID];
        onChange();
      });
    });
  } catch (err) {
    console.warn('Failed to claim lobby role.', err);

    try {
      [peer, lobbyConnection] = await getLobbyConnection(opts);
      console.log('lobbyConnection', lobbyConnection);
      lobbyConnection.on('data', (_lobbyState) => {
        console.log('Got data from lobby!', _lobbyState);
        lobbyState = _lobbyState;
        API.emit('change', _lobbyState)
      });

      lobbyConnection.on('close', () => {
        console.warn('Connection with lobby closed!');
      });
    } catch (err) {
      console.error('Could not connect to lobby.', err);
    }
  }

  API.create = function create (data={}) {
    return new Promise((resolve, reject) => {
      if (lobbyConnection) {
        lobbyConnection.send({
          type: 'createChannel',
          data: data,
        });
      } else if (lobbyPeer) {
        createChannel({
          peerID: peer.id,
          data: data,
        });
      }
      
      let channel = new EventEmitter;
      let connections = [];
      let send = (data) => {
        channel.emit('data', data);

        connections.forEach((conn) => {
          console.log('sending data to connection', conn);
          conn.send(data);
        });
      };
      peer.on('connection', (connection) => {
        connections.push(connection);
        channel.emit('join', connection);

        connection.on('data', send);

        connection.on('close', () => {
          console.warn('Channel: Peer connection closed', connection);
          channel.emit('left', connection);
          connections.splice(connections.indexOf(connection), 1);
        });

        connection.on('error', (err) => {
          console.error('Channel: Unexpected error', err);
          channel.emit('error', err);
          connection.close();
        });
      });

      channel.send = send;
      channel.id = peer.id;

      resolve(channel);
    });
  }

  API.join = function join (channelID) {
    return new Promise((resolve, reject) => {
      if (lobbyConnection) {
        lobbyConnection.send({
          type: 'joinChannel',
          channelID: channelID,
        });
      } else if (lobbyPeer) {
        joinChannel({
          channelID: channelID,
        });
      }
      
      let channel = new EventEmitter;

      let connection = peer.connect(channelID);

      connection.on('open', () => {
        console.log('connection opened!!');
        channel.send = (data) => {
          connection.send(data);
        };

        connection.on('data', (data) => {
          console.log('received data', data);
          channel.emit('data', data);
        });

        channel.id = channelID;
        
        resolve(channel);
      });
      
      connection.on('close', () => {
        console.warn('Connection with channel closed; channelID:', channelID);
      });

      connection.on('error', (err) => {
        console.error('Failed to connect to channel with id', channelID, err);
        connection.close();
      });
    });
  }

  function onUnload () {
    if (peer && peer.destroy) {
      peer.destroy();
    }
  }

  window.addEventListener('unload', onUnload);
  window.addEventListener('beforeunload', onUnload);

  return API;
}

export default LobbyRTC;