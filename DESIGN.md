
```js
import LobbyRTC from 'lobbyRTC';

let lobby = await LobbyRTC({APIKey: 'abc123'});

lobby.on('change', (channels) => {
  console.log('channels:', channels);
});

/* lobby.channels()... looks like this:
[
  <id>: {
    meta: {
      peers: 4, // # of connected peers at this point in time
      id: <Unique-ID>, // Use this to connect
    },
    data: {
      // Can be anything! Use this for channel name, topics, etc. whatever.
    }
  },
  <id>: {...},
  <id>: {...},
  ...
]
*/

let channelInfo = {
  can: 'be',
  anything: 'at all',
};

let channel = await lobby.create(channelInfo);

// OR:

let channel = await lobby.join('<Channel-ID>');

channel.on('join', (peer) => {
  console.log('peer joined: ', peer);
});

channel.on('left', (peer) => {
  console.log('peer left: ', peer);
});

channel.send({yay: 42});

channel.on('data', (msg) => {
  console.log('data received:', msg.data, 'from', msg.meta);
});

channel.on('error', (err) => {
  console.error('derp', err);
});


channel.leave();
```


# Reconnecting/Lobby-role-transfer

All peers start by attempting to claim the lobby role.
This is done by specifying a fixed lobby ID for PeerJS.

If that fails because the ID is taken, we claim a random ID, and
connect with the lobby.

The lobby keeps all peers' data about the lobby in sync.
Non-lobby peers listen for events from the lobby and track
the current lobby state if they need to take the role of lobby.

When a "close" and "error" event occurs from the lobby peer,
we attempt to claim the lobby role, using the existing lobby state
data that the lobby peer transferred to us.

If we fail to reclaim the lobby, we try reconnecting to the lobby, which
was probably claimed by another peer before we claimed it.
