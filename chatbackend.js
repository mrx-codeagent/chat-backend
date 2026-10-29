const http = require('node:http');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const express = require('express');
const { Server } = require('socket.io');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES_PER_WINDOW = 8;
const MESSAGE_WINDOW_MS = 5000;
const MAX_AVATAR_LENGTH = 350_000;
const CHAT_ROOM = 'chat-room';
const STICKERS = new Set([
	'👋', '😊', '😄', '🥰', '🤗', '😎', '🥳', '🫶', '🙌', '👏',
	'💚', '💙', '💜', '💛', '💖', '✨', '⭐', '🌟', '🌈', '☀️',
	'🌙', '🌸', '🌷', '🌻', '🍀', '🦋', '🐱', '🐶', '🐼', '🦊',
	'🐸', '🐰', '🐻', '🐧', '🦄', '🍓', '🍉', '🍰', '☕', '🎈',
	'🎉', '🎨', '🎵', '🧸', '🪴', '💌', '💫', '✅', '👍', '💐',
]);

function parseAllowedOrigins(value) {
	if (!value) return '*';
	const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
	return origins.length ? origins : '*';
}

function createChatServer({ frontendOrigins = process.env.FRONTEND_ORIGINS } = {}) {
	const app = express();
	const server = http.createServer(app);
	app.use(express.static(path.join(__dirname, 'public')));
	const io = new Server(server, {
		cors: {
			origin: parseAllowedOrigins(frontendOrigins),
			methods: ['GET', 'POST'],
		},
	});
	const sessions = new Map();
	const history = [];

	function activeCount() {
		return [...sessions.values()].filter((session) => session.active).length;
	}

	function broadcastPresence() {
		io.emit('presence:update', { onlineCount: activeCount() });
		io.to(CHAT_ROOM).emit('members:update', currentMembers());
	}

	function currentMembers() {
		return [...sessions.entries()]
			.filter(([, session]) => session.active)
			.map(([id, session]) => ({ id, username: session.username, avatarUrl: session.avatarUrl }));
	}

	function broadcastTyping() {
		io.to(CHAT_ROOM).emit('typing:update', [...sessions.entries()]
			.filter(([, session]) => session.active && session.typing)
			.map(([id, session]) => ({ id, username: session.username })));
	}

	function makeIdentityMessage(previousName, nextName, avatarChanged) {
		const sameName = previousName === nextName;
		const text = sameName
			? `${previousName} profil rasmini o‘zgartirdi`
			: `${previousName} ismini ${nextName} ga o‘zgartirdi`;
		return {
			id: randomUUID(),
			type: 'system',
			event: sameName && avatarChanged ? 'avatar-change' : 'rename',
			username: nextName,
			previousUsername: previousName,
			text,
			sentAt: new Date().toISOString(),
		};
	}

	function makeSystemMessage(username, event) {
		return {
			id: randomUUID(),
			type: 'system',
			event,
			username,
			text: `${username} ${event === 'join' ? 'xonaga qo‘shildi' : 'xonadan chiqdi'}`,
			sentAt: new Date().toISOString(),
		};
	}

	function normalizeAvatar(value) {
		if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH) return null;
		return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) ? value : null;
	}

	function joinRoom(socket, payload) {
		const session = sessions.get(socket.id);
		if (!session || session.active) return;
		const previousName = session.username;
		const previousAvatar = session.avatarUrl;

		const requestedName = typeof payload?.username === 'string' ? payload.username : '';
		session.username = requestedName
			.replace(/[\u0000-\u001f\u007f]/g, '')
			.trim()
			.slice(0, 32) || `Guest-${socket.id.slice(0, 6)}`;
		session.avatarUrl = normalizeAvatar(payload?.avatarUrl);
		session.active = true;
		if (activeCount() === 1) history.length = 0;

		socket.join(CHAT_ROOM);
		socket.emit('chat:history', history.slice());
		const identityChanged = Boolean(previousName)
			&& (previousName !== session.username || previousAvatar !== session.avatarUrl);
		const message = identityChanged
			? makeIdentityMessage(previousName, session.username, previousAvatar !== session.avatarUrl)
			: makeSystemMessage(session.username, 'join');
		history.push(message);
		io.to(CHAT_ROOM).emit('chat:message', message);
		socket.emit('room:joined');
		broadcastPresence();
		socket.emit('typing:update', [...sessions.entries()]
			.filter(([id, member]) => id !== socket.id && member.active && member.typing)
			.map(([id, member]) => ({ id, username: member.username })));
	}

	function leaveRoom(socket, { disconnected = false } = {}) {
		const session = sessions.get(socket.id);
		if (!session?.active) return;

		session.active = false;
		session.typing = false;
		if (!disconnected) socket.leave(CHAT_ROOM);
		const message = makeSystemMessage(session.username, 'leave');
		history.push(message);
		io.to(CHAT_ROOM).emit('chat:message', message);
		if (!disconnected) {
			socket.emit('chat:message', message);
			socket.emit('members:update', currentMembers());
		}
		broadcastPresence();
		broadcastTyping();

		if (activeCount() === 0) {
			history.length = 0;
			io.emit('chat:reset');
		}
	}

	app.get('/health', (_request, response) => {
		response.json({
			status: 'ok',
			onlineCount: activeCount(),
			persistence: 'disabled',
		});
	});

	io.on('connection', (socket) => {
		sessions.set(socket.id, { username: '', avatarUrl: null, active: false, typing: false, messageTimes: [] });
		socket.on('room:join', (payload) => joinRoom(socket, payload));
		socket.on('room:leave', () => leaveRoom(socket));
		socket.on('typing:set', (isTyping) => {
			const session = sessions.get(socket.id);
			if (!session?.active || typeof isTyping !== 'boolean' || session.typing === isTyping) return;
			session.typing = isTyping;
			broadcastTyping();
		});

		socket.on('chat:send', (payload) => {
			const user = sessions.get(socket.id);
			if (!user?.active) return;
			if (user.typing) {
				user.typing = false;
				broadcastTyping();
			}

			if (payload?.type === 'sticker') {
				if (!STICKERS.has(payload.sticker)) {
					socket.emit('chat:error', { code: 'INVALID_STICKER' });
					return;
				}

				const now = Date.now();
				user.messageTimes = user.messageTimes.filter((time) => now - time < MESSAGE_WINDOW_MS);
				if (user.messageTimes.length >= MAX_MESSAGES_PER_WINDOW) {
					socket.emit('chat:error', { code: 'RATE_LIMITED' });
					return;
				}
				user.messageTimes.push(now);
				const stickerMessage = {
					id: randomUUID(),
					type: 'sticker',
					username: user.username,
					avatarUrl: user.avatarUrl,
					sticker: payload.sticker,
					sentAt: new Date(now).toISOString(),
				};
				history.push(stickerMessage);
				io.to(CHAT_ROOM).emit('chat:message', stickerMessage);
				return;
			}

			const text = typeof payload === 'string' ? payload : payload?.text;

			if (typeof text !== 'string' || !text.trim()) {
				socket.emit('chat:error', { code: 'INVALID_MESSAGE' });
				return;
			}

			const normalizedText = text.trim();
			if (normalizedText.length > MAX_MESSAGE_LENGTH) {
				socket.emit('chat:error', { code: 'MESSAGE_TOO_LONG', maxLength: MAX_MESSAGE_LENGTH });
				return;
			}

			const now = Date.now();
			user.messageTimes = user.messageTimes.filter((time) => now - time < MESSAGE_WINDOW_MS);
			if (user.messageTimes.length >= MAX_MESSAGES_PER_WINDOW) {
				socket.emit('chat:error', { code: 'RATE_LIMITED' });
				return;
			}
			user.messageTimes.push(now);

			const message = {
				id: randomUUID(),
				type: 'text',
				username: user.username,
				avatarUrl: user.avatarUrl,
				text: normalizedText,
				sentAt: new Date(now).toISOString(),
			};
			history.push(message);
			io.to(CHAT_ROOM).emit('chat:message', message);
		});

		socket.on('disconnect', () => {
			leaveRoom(socket, { disconnected: true });
			sessions.delete(socket.id);
		});
	});

	return { app, server, io };
}

if (require.main === module) {
	const { server } = createChatServer();
	const port = Number(process.env.PORT) || 3000;
	server.listen(port, '0.0.0.0', () => {
		console.log(`Ephemeral chat backend listening on port ${port}`);
	});
}

module.exports = { createChatServer };
