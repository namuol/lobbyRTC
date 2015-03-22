import 'babel/polyfill';

import 'whatwg-fetch';

import React from 'react';

import freeStyle from 'free-style';

import qs from 'qs';

import page from 'page';
import LobbyRTC from '../../..';

import App from './App';

freeStyle.inject();

window.addEventListener('load', async function () {
  let props = qs.parse(location.search.slice(1));
  console.log('props', props);
  
  let lobby = await LobbyRTC({APIKey: 'w68p17ra5u1y8pvi'});
  
  lobby.on('change', (lobbyState) => {
    console.log('New Lobby state:', lobbyState);
  });

  page('/', async function () {
    React.render(<App {...props} loading={true} />, document.getElementById('main'));
    React.render(
      <App {...props} loading={false} />
    , document.getElementById('main'));
  });

  page.start();
});
