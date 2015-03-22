import React from 'react';

import freeStyle from 'free-style';

let STYLE = freeStyle.registerStyle({
  display: 'flex',
});

let App = React.createClass({
  getInitialState: function () {
    return {
      channels: {},
      messages: [],
      messageText: '',
    };
  },

  _setupListeners: function (props) {
    if (this.props.lobby) {
      this.props.lobby.removeListener('change', this._onLobbyChanged);
    }
    props.lobby.on('change', this._onLobbyChanged);

    if (props.channel) {
      if (this.props.channel) {
        this.props.channel.removeListener('data', this._onChannelData);
      }
      props.channel.on('data', this._onChannelData);
    }
  },

  _onLobbyChanged: function (lobbyState) {
    this.setState({
      channels: lobbyState.channels,
    });
  },

  _onChannelData: function (data) {
    let messages = this.state.messages.slice(0);
    messages.push(data);
    this.setState({
      messages: messages
    });
  },

  componentWillMount: function () {
    this._setupListeners(this.props);
  },

  componentWillReceiveProps: function (props) {
    this._setupListeners(props);
  },

  componentWillUnmount: function () {
    this.props.lobby.removeListener('change', this._onLobbyChanged);
    if (this.props.channel) {
      this.props.channel.removeListener('data', this._onChannelData);
    }
  },

  render: function() {
    console.log("Re-rendering app!");

    let channels = Object.keys(this.state.channels).map((channelID) => {
      let channel = this.state.channels[channelID];
      return (
        <li key={channelID}><a href={`/${channel.data.name}/${channelID}`}>{channel.data.name}</a></li>
      );
    });

    let messages = this.state.messages.map((msg, i) => {
      return (
        <li key={i}>{msg.text}</li>
      );
    });

    return (
      <div className={STYLE.className}>
        <ul style={{
          width: '30%',
        }}>
          {channels}
        </ul>
        
        <div>
          <ul>
            {messages}
          </ul>
          <div>
            <input value={this.state.messageText} onChange={(e) => {
              this.setState({
                messageText: e.target.value,
              });
            }} />

            <button disabled={this.state.messageText ? false : true} onClick={(e) => {
              this.props.channel.send({
                text: this.state.messageText,
              });

              this.setState({
                messageText: '',
              });
            }}>SEND</button>
          </div>
        </div>
      </div>
    );
  }

});

export default  App;