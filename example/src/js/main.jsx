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

  page('/', async function () {
    render();
  });

  let channel;
  page('/:channel', async function (ctx) {
    channel = await lobby.create({name: ctx.params.channel});
    page.redirect(`/${ctx.params.channel}/${channel.id}`);
  });

  page('/:channel/:channelID', async function (ctx) {
    if (!channel) {
      channel = await lobby.join(ctx.params.channelID);
    }
    render();
  });

  page.start();

  function render () {
    React.render(
      <App lobby={lobby} channel={channel} />
    , document.getElementById('main'));
  }

  render();
});
