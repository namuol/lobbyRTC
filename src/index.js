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

  try {
    peer = lobbyPeer = await claimLobbyRole(opts);
    
    let connections = {};

    lobbyPeer.on('connection', (connection) => {
      console.log('Lobby role: new peer connected', connection);
      let connectionLabel = connection.label;
      let peerID = connection.peer;

      let handlers = {
        createChannel: (msg) => {
          if (lobbyState.channels[peerID]) {
            console.error(`Lobby role: Channel with ID "${peerID}" already exists; aborting!`);
            return;
          }

          lobbyState.channels[peerID] = {
            meta: {
              peers: 1,
              id: peerID,
            },
            data: msg.data,
          };
        },

        joinChannel: (msg) => {
          let {id} = msg.meta;
          let channel = lobbyState.channels[id];
          if (!channel) {
            console.error('Lobby role: Could not find channel with ID:', id);
            return;
          }
          channel.meta.peers += 1;
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

      setTimeout(() => {
        console.log('Sending lobbyState', lobbyState);
        connection.send(lobbyState);
        connection.send('Hi!');
        console.log('Sent stuff!');
      }, 2000);

      connection.on('data', (msg) => {
        console.log('Lobby role: got message:', msg);
        handler = handlers[msg.type];

        if (!handler) {
          console.error('Lobby role: Unexpected incoming message type: ', msg.type);
          console.info('Lobby role: These are the valid message types: ', Object.keys(handlers));
          return;
        }

        handler(msg);

        API.emit('change', lobbyState);

        Object.keys(connections).forEach((_connectionLabel) => {
          if (connectionLabel === _connectionLabel) {
            return;
          }

          connections[connectionLabel].send(lobbyState);
        });
      });

      connection.on('error', (err) => {
        console.error('Lobby role: Unexpected error from connection', err);
        connection.close();
      });

      connection.on('close', () => {
        console.warn('Lobby role: Connection closed', connection);
        delete connections[connectionLabel];
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
    if (lobbyConnection) {
      lobbyConnection.send({
        type: 'createChannel',
        data: data,
      });
    } else if (lobbyPeer) {
    }
  }

  API.join = function join (opts={}) {
  }

  return API;
}

export default LobbyRTC;