const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');
const { io: createClient } = require('socket.io-client');
const { createChatServer } = require('../chatbackend');

const clients = [];
let server;
let address;

before(async () => {
  ({ server } = createChatServer({ frontendOrigins: '*' }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  address = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const client of clients) client.disconnect();
  await new Promise((resolve) => server.close(resolve));
});

async function connect() {
  const client = createClient(address, {
    transports: ['websocket'],
  });
  clients.push(client);
  await once(client, 'connect');
  return client;
}

async function join(client, username, avatarUrl = null) {
  const historyEvent = once(client, 'chat:history');
  const joinEvent = waitForMessage(client, (message) => message.event === 'join');
  client.emit('room:join', { username, avatarUrl });
  const [[messages], joined] = await Promise.all([historyEvent, joinEvent]);
  assert.equal(joined.type, 'system');
  assert.equal(joined.event, 'join');
  assert.equal(joined.username, username);
  return messages;
}

function waitForMessage(client, predicate) {
  return new Promise((resolve) => {
    const listener = (message) => {
      if (!predicate(message)) return;
      client.off('chat:message', listener);
      resolve(message);
    };
    client.on('chat:message', listener);
  });
}

test('keeps chat history while anyone remains, and clears it when the room empties', { timeout: 8000 }, async () => {
  const firstUser = await connect();
  const avatarUrl = 'data:image/jpeg;base64,SGVsbG8=';
  const initialHistory = await join(firstUser, 'First', avatarUrl);
  assert.deepEqual(initialHistory, []);

  const firstUserMessage = once(firstUser, 'chat:message');
  firstUser.emit('chat:send', { text: 'Hello in the room' });
  const [delivered] = await firstUserMessage;
  assert.equal(delivered.text, 'Hello in the room');
  assert.equal(delivered.username, 'First');
  assert.equal(delivered.avatarUrl, avatarUrl);

  const stickerForFirst = once(firstUser, 'chat:message');
  firstUser.emit('chat:send', { type: 'sticker', sticker: '🌈' });
  const [stickerMessage] = await stickerForFirst;
  assert.equal(stickerMessage.type, 'sticker');
  assert.equal(stickerMessage.sticker, '🌈');

  const secondUser = await connect();
  const secondHistory = await join(secondUser, 'Second');
  assert.ok(secondHistory.some((message) => message.text === 'Hello in the room'));
  assert.ok(secondHistory.some((message) => message.type === 'sticker' && message.sticker === '🌈'));

  const firstMembers = once(firstUser, 'members:update');
  const secondTyping = once(firstUser, 'typing:update');
  secondUser.emit('typing:set', true);
  const [[members], [typingMembers]] = await Promise.all([firstMembers, secondTyping]);
  assert.equal(members.length, 2);
  assert.ok(typingMembers.some((member) => member.username === 'Second'));
  const firstUserTyping = once(firstUser, 'typing:update');
  firstUser.emit('typing:set', true);
  const [bothTyping] = await firstUserTyping;
  assert.equal(bothTyping.length, 2);
  const typingCleared = once(firstUser, 'typing:update');
  secondUser.emit('chat:send', { text: 'I was typing' });
  const [oneStillTyping] = await typingCleared;
  assert.deepEqual(oneStillTyping.map((member) => member.username), ['First']);
  firstUser.emit('typing:set', false);

  const membersAfterLeave = once(firstUser, 'members:update');
  const secondLeavingNotice = waitForMessage(firstUser, (message) => message.event === 'leave');
  const resets = [once(firstUser, 'chat:reset'), once(secondUser, 'chat:reset')];
  secondUser.emit('room:leave');
  const leavingMessage = await secondLeavingNotice;
  assert.equal(leavingMessage.username, 'Second');
  const [remainingMembers] = await membersAfterLeave;
  assert.deepEqual(remainingMembers.map((member) => member.username), ['First']);

  const identityNotice = waitForMessage(firstUser, (message) => message.event === 'rename');
  const rejoinedHistoryEvent = once(secondUser, 'chat:history');
  const rejoinedEvent = waitForMessage(secondUser, (message) => message.event === 'rename');
  secondUser.emit('room:join', { username: 'SecondNew', avatarUrl });
  const [[rejoinedHistory], rejoinedIdentityNotice, broadcastIdentityNotice] = await Promise.all([
    rejoinedHistoryEvent,
    rejoinedEvent,
    identityNotice,
  ]);
  assert.ok(rejoinedHistory.some((message) => message.text === 'Hello in the room'));
  assert.equal(rejoinedIdentityNotice.previousUsername, 'Second');
  assert.equal(rejoinedIdentityNotice.username, 'SecondNew');
  assert.equal(broadcastIdentityNotice.text, 'Second ismini SecondNew ga o‘zgartirdi');

  const secondAvatarLeaveNotice = waitForMessage(firstUser, (message) => message.event === 'leave');
  secondUser.emit('room:leave');
  await secondAvatarLeaveNotice;
  const avatarChangeNotice = waitForMessage(firstUser, (message) => message.event === 'avatar-change');
  const avatarRejoinHistory = once(secondUser, 'chat:history');
  const avatarRejoinEvent = waitForMessage(secondUser, (message) => message.event === 'avatar-change');
  secondUser.emit('room:join', { username: 'SecondNew', avatarUrl: null });
  const [[resumedHistory], resumedIdentity, avatarNotice] = await Promise.all([
    avatarRejoinHistory,
    avatarRejoinEvent,
    avatarChangeNotice,
  ]);
  assert.ok(resumedHistory.some((message) => message.text === 'Hello in the room'));
  assert.equal(resumedIdentity.text, 'SecondNew profil rasmini o‘zgartirdi');
  assert.equal(avatarNotice.event, 'avatar-change');

  const firstLeavingNotice = waitForMessage(secondUser, (message) => message.event === 'leave');
  firstUser.emit('room:leave');
  const firstLeavingMessage = await firstLeavingNotice;
  assert.equal(firstLeavingMessage.event, 'leave');

  secondUser.emit('room:leave');
  await Promise.all(resets);

  const thirdUser = await connect();
  const freshHistory = await join(thirdUser, 'Third');
  assert.deepEqual(freshHistory, []);
});