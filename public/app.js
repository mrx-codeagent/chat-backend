const joinForm = document.querySelector('#join-form');
const usernameInput = document.querySelector('#username');
const leaveButton = document.querySelector('#leave-button');
const joinError = document.querySelector('#join-error');
const brandButton = document.querySelector('#brand-button');
const membersList = document.querySelector('#members-list');
const avatarStack = document.querySelector('#avatar-stack');
const profilePrompt = document.querySelector('#profile-prompt');
const avatarFile = document.querySelector('#avatar-file');
const avatarYes = document.querySelector('#avatar-yes');
const avatarNo = document.querySelector('#avatar-no');
const profilePreview = document.querySelector('#profile-preview');
const avatarChoiceLabel = document.querySelector('#avatar-choice-label');
const messageList = document.querySelector('#message-list');
const emptyState = document.querySelector('#empty-state');
const messageForm = document.querySelector('#message-form');
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const connectionBanner = document.querySelector('#connection-banner');
const typingIndicator = document.querySelector('#typing-indicator');
const typingNames = document.querySelector('#typing-names');
const stickerToggle = document.querySelector('#sticker-toggle');
const stickerPicker = document.querySelector('#sticker-picker');
const stickerGrid = document.querySelector('#sticker-grid');
const stickerClose = document.querySelector('#sticker-close');
const sceneCanvas = document.querySelector('#scene-canvas');
let socket = null;
let username = '';
let avatarUrl = null;
let typingTimer = null;
let typing = false;
let roomJoined = false;
const messageIds = new Set();
const stickers = ['👋', '😊', '😄', '🥰', '🤗', '😎', '🥳', '🫶', '🙌', '👏', '💚', '💙', '💜', '💛', '💖', '✨', '⭐', '🌟', '🌈', '☀️', '🌙', '🌸', '🌷', '🌻', '🍀', '🦋', '🐱', '🐶', '🐼', '🦊', '🐸', '🐰', '🐻', '🐧', '🦄', '🍓', '🍉', '🍰', '☕', '🎈', '🎉', '🎨', '🎵', '🧸', '🪴', '💌', '💫', '✅', '👍', '💐'];

const sceneNames = ['Snowfall', 'Aurora', 'Cat Aurora', 'Fireflies', 'Moonlight', 'Planets', 'Starflight', 'Star Map', 'Meteor Shower', 'Star Letters'];
const alphabetLetters = ['S', 'R', 'Q', 'P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'B', 'A'];
const alphabetStarCount = 180;
const sceneDuration = 15000;
const snowfallSceneDuration = 60000;
const starLetterHoldDuration = 1500;
const starLetterSceneDuration = sceneDuration + starLetterHoldDuration;
const sceneFadeDuration = 1400;
const flightColors = ['#77dcff', '#c19aff', '#ffdc86', '#81f0d0'];
const sceneColors = [
	['#54d6a4', '#78a5ef', '#b48be0', '#d2dc79', '#d582b6'],
	['#ffd66e', '#f4ad48', '#fff1a3'],
	['#b9d8ff', '#e5c7ff', '#ffffff'],
	['#68d3ff', '#b17aff', '#69e0b0', '#ff9dcb'],
	['#77dcff', '#c19aff', '#ffdc86', '#81f0d0'],
];
let sceneFrame = 0;
let sceneSize = { width: 0, height: 0, ratio: 1 };
let sceneStars = [];
let fireflies = [];
let travelStars = [];
let spaceObjects = [];
let alphabetTargets = [];
let sceneStartedAt = 0;
let sceneReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let sceneLastDraw = 0;

function seeded(index, salt = 0) {
	const value = Math.sin((index + 1) * 127.1 + (salt + 1) * 311.7) * 43758.5453;
	return value - Math.floor(value);
}

function getSceneDuration(index) {
	if (sceneNames[index] === 'Snowfall') return snowfallSceneDuration;
	if (sceneNames[index] === 'Star Letters') return starLetterSceneDuration;
	return sceneDuration;
}

function createAlphabetTargets() {
	const { width, height } = sceneSize;
	const mask = document.createElement('canvas');
	const context = mask.getContext('2d', { willReadFrequently: true });
	mask.width = Math.max(1, Math.round(width));
	mask.height = Math.max(1, Math.round(height));
	context.clearRect(0, 0, mask.width, mask.height);
	const fontSize = Math.min(width * .62, height * .74);
	context.font = `700 ${fontSize}px Manrope, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillStyle = '#fff';
	alphabetTargets = alphabetLetters.map((letter) => {
		context.clearRect(0, 0, mask.width, mask.height);
		context.fillText(letter, width / 2, height / 2);
		const pixels = context.getImageData(0, 0, mask.width, mask.height).data;
		const points = [];
		const step = Math.max(3, Math.round(fontSize / 55));
		for (let y = 0; y < mask.height; y += step) {
			for (let x = 0; x < mask.width; x += step) {
				if (pixels[(y * mask.width + x) * 4 + 3] > 100) points.push({ x, y });
			}
		}
		return Array.from({ length: alphabetStarCount }, (_, index) => {
			const point = points[Math.floor(index * points.length / alphabetStarCount)] || { x: width / 2, y: height / 2 };
			return { x: point.x, y: point.y };
		});
	});
}

function createSceneParticles() {
	const { width, height } = sceneSize;
	sceneStars = Array.from({ length: 95 }, (_, index) => ({
		x: seeded(index, 2) * width,
		y: seeded(index, 3) * height,
		radius: .35 + seeded(index, 4) * 1.25,
		phase: seeded(index, 5) * Math.PI * 2,
		speed: .45 + seeded(index, 6) * 1.1,
	}));
	fireflies = Array.from({ length: Math.max(32, Math.round(width * height / 14500)) }, (_, index) => ({
		x: seeded(index, 7) * width,
		y: seeded(index, 8) * height,
		radius: 1.1 + seeded(index, 9) * 2.2,
		phase: seeded(index, 10) * Math.PI * 2,
		speed: .35 + seeded(index, 11) * .8,
		drift: .4 + seeded(index, 12) * 1.5,
	}));
	travelStars = Array.from({ length: 440 }, (_, index) => ({
		x: (seeded(index, 13) - .5) * 2,
		y: (seeded(index, 14) - .5) * 2,
		z: .12 + seeded(index, 15) * .88,
		previousZ: 0,
		color: flightColors[Math.floor(seeded(index, 16) * flightColors.length)],
	}));
	spaceObjects = Array.from({ length: 36 }, (_, index) => ({
		x: (seeded(index, 17) - .5) * 1.05,
		y: (seeded(index, 18) - .5) * .9,
		z: .68 + seeded(index, 19) * .95,
		radius: 7 + seeded(index, 20) * 20,
		rotation: seeded(index, 21) * Math.PI * 2,
		rotationSpeed: (seeded(index, 22) - .5) * .0012,
		kind: seeded(index, 23) < .57 ? 'planet' : seeded(index, 23) < .88 ? 'asteroid' : 'comet',
		palette: Math.floor(seeded(index, 24) * 4),
		ringed: seeded(index, 25) > .67,
		cycle: 0,
	}));
	createAlphabetTargets();
}

function resizeSceneCanvas() {
	const rect = sceneCanvas.getBoundingClientRect();
	const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
	sceneSize = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), ratio };
	sceneCanvas.width = Math.round(sceneSize.width * ratio);
	sceneCanvas.height = Math.round(sceneSize.height * ratio);
	createSceneParticles();
	if (roomJoined) renderScene(performance.now());
}

function drawGlow(ctx, x, y, radius, color, strength = .5) {
	const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
	glow.addColorStop(0, `${color}${Math.round(Math.min(1, strength) * 255).toString(16).padStart(2, '0')}`);
	glow.addColorStop(1, `${color}00`);
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
}

function auroraBackground(ctx, time) {
	const { width, height } = sceneSize;
	const sky = ctx.createLinearGradient(0, 0, 0, height);
	sky.addColorStop(0, '#050713');
	sky.addColorStop(.48, '#071729');
	sky.addColorStop(1, '#07110f');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);
	const stars = sceneStars;
	for (const star of stars) {
		const pulse = .3 + .7 * ((Math.sin(time * .0008 * star.speed + star.phase) + 1) / 2);
		ctx.fillStyle = `rgba(219, 232, 255, ${.13 + pulse * .38})`;
		ctx.beginPath();
		ctx.arc(star.x, star.y * .72, star.radius * .72, 0, Math.PI * 2);
		ctx.fill();
	}
	const horizonGlow = ctx.createLinearGradient(0, height * .38, 0, height * .9);
	horizonGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
	horizonGlow.addColorStop(.74, 'rgba(21, 64, 77, .12)');
	horizonGlow.addColorStop(1, 'rgba(4, 10, 17, .52)');
	ctx.fillStyle = horizonGlow;
	ctx.fillRect(0, height * .38, width, height * .62);
}

function drawAuroraCurtains(ctx, time, options = {}) {
	const { width, height } = sceneSize;
	const top = -height * .08;
	const bottom = height * .79;
	const left = options.left ?? -width * .12;
	const fieldWidth = options.width ?? width * 1.24;
	const curtainCount = options.density ?? 8;
	const phaseOffset = options.phaseOffset || 0;
	const phaseBase = time * .00016 + phaseOffset;
	const altitudeColors = ctx.createLinearGradient(0, top, 0, bottom);
	altitudeColors.addColorStop(0, 'rgba(126, 53, 185, 0)');
	altitudeColors.addColorStop(.12, 'rgba(159, 73, 203, .18)');
	altitudeColors.addColorStop(.3, 'rgba(71, 113, 227, .18)');
	altitudeColors.addColorStop(.48, 'rgba(0, 204, 179, .3)');
	altitudeColors.addColorStop(.68, 'rgba(56, 255, 91, .5)');
	altitudeColors.addColorStop(.84, 'rgba(137, 255, 35, .58)');
	altitudeColors.addColorStop(1, 'rgba(62, 227, 82, 0)');

	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	ctx.filter = 'blur(22px)';
	for (let curtain = 0; curtain < curtainCount; curtain += 1) {
		const seed = seeded(curtain, phaseOffset + 9);
		const across = (curtain + .16 + seed * .44) / curtainCount;
		const center = left + across * fieldWidth;
		const phase = phaseBase + seed * 4.8 + across * 3.2;
		const ribbonWidth = fieldWidth * (.025 + seed * .038);
		const drift = Math.sin(phase * .27 + seed * 6) * fieldWidth * .11;
		const drawRibbon = (widthScale) => {
			ctx.beginPath();
			for (let segment = 0; segment <= 18; segment += 1) {
				const progress = segment / 18;
				const y = top + (bottom - top) * progress;
				const wave = Math.sin(progress * 5.1 - phase * .55 + seed * 5) * fieldWidth * .045
					+ Math.sin(progress * 10.4 - phase * .82 + across * 9) * fieldWidth * .014
					+ drift * progress;
				const flare = .55 + .72 * Math.sin(progress * Math.PI * .88);
				const x = center + wave - ribbonWidth * flare * widthScale * .5;
				if (segment === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			for (let segment = 18; segment >= 0; segment -= 1) {
				const progress = segment / 18;
				const y = top + (bottom - top) * progress;
				const wave = Math.sin(progress * 5.1 - phase * .55 + seed * 5) * fieldWidth * .045
					+ Math.sin(progress * 10.4 - phase * .82 + across * 9) * fieldWidth * .014
					+ drift * progress;
				const flare = .55 + .72 * Math.sin(progress * Math.PI * .88);
				const x = center + wave + ribbonWidth * flare * widthScale * .5;
				ctx.lineTo(x, y);
			}
			ctx.closePath();
		};

		ctx.globalAlpha = .17 + seed * .1;
		ctx.fillStyle = altitudeColors;
		ctx.shadowColor = seed > .62 ? '#9a56ee' : '#32ff70';
		ctx.shadowBlur = ribbonWidth * .28;
		drawRibbon(1.45);
		ctx.fill();

		ctx.filter = 'blur(6px)';
		ctx.globalAlpha = .18 + seed * .12;
		ctx.shadowBlur = ribbonWidth * .1;
		drawRibbon(.62);
		ctx.fill();
		ctx.filter = 'blur(2px)';
		ctx.globalAlpha = .08 + seed * .07;
		ctx.shadowBlur = 0;
		drawRibbon(.22);
		ctx.fill();
		ctx.filter = 'blur(22px)';
	}
	ctx.filter = 'none';
	ctx.shadowBlur = 0;
	ctx.restore();
}

function drawAurora(ctx, time) {
	auroraBackground(ctx, time);
	drawAuroraCurtains(ctx, time);
}

function drawCatAurora(ctx, time) {
	const { width, height } = sceneSize;
	auroraBackground(ctx, time);
	drawAuroraCurtains(ctx, time, { density: Math.round(width / 20), phaseOffset: 4 });

	// The cat is a softly glowing aurora cloud, not a set of drawn filaments.
	const scale = Math.min(width * .53, height * .74);
	const centerX = width * .51 + Math.sin(time * .00012) * width * .018;
	const baseY = height * .74 + Math.sin(time * .00017) * height * .012;
	const x = value => centerX + value * scale;
	const y = value => baseY + value * scale;
	const silhouette = () => {
		ctx.beginPath();
		ctx.moveTo(x(-.34), y(.3));
		ctx.bezierCurveTo(x(-.43), y(.14), x(-.37), y(-.02), x(-.29), y(-.14));
		ctx.lineTo(x(-.35), y(-.53));
		ctx.quadraticCurveTo(x(-.18), y(-.48), x(-.07), y(-.37));
		ctx.quadraticCurveTo(x(0), y(-.41), x(.08), y(-.37));
		ctx.lineTo(x(.34), y(-.55));
		ctx.lineTo(x(.28), y(-.17));
		ctx.bezierCurveTo(x(.39), y(-.02), x(.34), y(.18), x(.2), y(.3));
		ctx.bezierCurveTo(x(.18), y(.4), x(.04), y(.43), x(-.12), y(.42));
		ctx.bezierCurveTo(x(-.28), y(.42), x(-.36), y(.38), x(-.34), y(.3));
		ctx.closePath();
	};

	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	silhouette();
	ctx.shadowColor = '#55f4ae';
	ctx.shadowBlur = scale * .1;
	const bodyGlow = ctx.createLinearGradient(centerX, baseY - scale * .65, centerX, baseY + scale * .45);
	bodyGlow.addColorStop(0, 'rgba(133, 87, 211, .04)');
	bodyGlow.addColorStop(.26, 'rgba(74, 194, 198, .17)');
	bodyGlow.addColorStop(.72, 'rgba(80, 255, 129, .32)');
	bodyGlow.addColorStop(1, 'rgba(145, 255, 117, .04)');
	ctx.filter = 'blur(15px)';
	ctx.globalAlpha = .8;
	ctx.fillStyle = bodyGlow;
	ctx.fill();
	ctx.filter = 'blur(7px)';
	ctx.globalAlpha = .45;
	ctx.fill();
	ctx.shadowBlur = 0;
	const innerGlow = ctx.createRadialGradient(centerX, baseY - scale * .12, scale * .04, centerX, baseY - scale * .12, scale * .75);
	innerGlow.addColorStop(0, 'rgba(156, 255, 173, .2)');
	innerGlow.addColorStop(.55, 'rgba(46, 236, 153, .11)');
	innerGlow.addColorStop(1, 'rgba(104, 104, 222, 0)');
	ctx.fillStyle = innerGlow;
	ctx.fillRect(centerX - scale, baseY - scale, scale * 2, scale * 1.6);
	ctx.filter = 'blur(18px)';
	for (let cloud = 0; cloud < 7; cloud += 1) {
		const seed = seeded(cloud, 121);
		const cloudX = centerX + (seed - .5) * scale * .58 + Math.sin(time * .00012 + cloud) * scale * .035;
		const cloudY = baseY - scale * .32 + cloud * scale * .09;
		const cloudGlow = ctx.createRadialGradient(cloudX, cloudY, scale * .015, cloudX, cloudY, scale * (.12 + seed * .08));
		cloudGlow.addColorStop(0, cloud % 3 === 0 ? 'rgba(179, 132, 255, .12)' : 'rgba(146, 255, 159, .14)');
		cloudGlow.addColorStop(1, 'rgba(72, 222, 170, 0)');
		ctx.fillStyle = cloudGlow;
		ctx.fillRect(cloudX - scale * .22, cloudY - scale * .22, scale * .44, scale * .44);
	}
	ctx.filter = 'none';
	ctx.restore();

	// A broad tapered glow keeps the curled tail part of the aurora silhouette.
	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	ctx.globalAlpha = .24 + .05 * Math.sin(time * .00035);
	ctx.filter = 'blur(8px)';
	ctx.fillStyle = 'rgba(91, 246, 165, .18)';
	ctx.shadowColor = '#73f2bd';
	ctx.shadowBlur = scale * .11;
	ctx.beginPath();
	ctx.moveTo(x(.13), y(.29));
	ctx.bezierCurveTo(x(.37), y(.33), x(.61), y(.18), x(.53), y(-.02));
	ctx.bezierCurveTo(x(.48), y(-.14), x(.3), y(-.15), x(.31), y(-.05));
	ctx.bezierCurveTo(x(.33), y(.02), x(.42), y(.01), x(.44), y(-.04));
	ctx.bezierCurveTo(x(.47), y(.12), x(.37), y(.24), x(.13), y(.29));
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawFireflies(ctx, time) {
	const { width, height } = sceneSize;
	for (const fly of fireflies) {
		const x = (fly.x + Math.sin(time * .00022 * fly.speed + fly.phase) * 42 + width) % width;
		const y = (fly.y + Math.cos(time * .00018 * fly.speed + fly.phase) * 29 + height) % height;
		const pulse = .38 + .62 * ((Math.sin(time * .0014 * fly.speed + fly.phase) + 1) / 2);
		const color = pulse > .76 ? '#fff1a3' : '#f5c955';
		drawGlow(ctx, x, y, fly.radius * 8, color, .16 * pulse);
		ctx.fillStyle = `rgba(255, 224, 119, ${.55 + pulse * .4})`;
		ctx.beginPath();
		ctx.arc(x, y, fly.radius * (.72 + pulse * .28), 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawMoonlight(ctx, time) {
	const { width, height } = sceneSize;
	for (const star of sceneStars) {
		const pulse = .35 + .65 * ((Math.sin(time * .0013 * star.speed + star.phase) + 1) / 2);
		ctx.fillStyle = `rgba(225, 236, 255, ${.18 + pulse * .68})`;
		ctx.beginPath();
		ctx.arc(star.x, star.y, star.radius * (.7 + pulse * .4), 0, Math.PI * 2);
		ctx.fill();
	}
	const moonX = width * .74;
	const moonY = height * .27;
	const radius = Math.min(width, height) * .105;
	drawGlow(ctx, moonX, moonY, radius * 2.8, '#b8d5ff', .17);
	const moon = ctx.createRadialGradient(moonX - radius * .4, moonY - radius * .45, radius * .12, moonX, moonY, radius);
	moon.addColorStop(0, '#fffdf0');
	moon.addColorStop(.68, '#dce8f5');
	moon.addColorStop(1, '#879fbb');
	ctx.fillStyle = moon;
	ctx.beginPath();
	ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = 'rgba(4, 9, 17, .9)';
	ctx.beginPath();
	ctx.arc(moonX + radius * .42, moonY - radius * .16, radius * .88, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = .12;
	for (const crater of [[-.27, -.12, .12], [.16, .26, .08], [-.08, .42, .06]]) {
		ctx.fillStyle = '#50627a';
		ctx.beginPath();
		ctx.arc(moonX + crater[0] * radius, moonY + crater[1] * radius, crater[2] * radius, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
}

function drawPlanet(ctx, x, y, radius, colors, rotation, ring = false) {
	const gradient = ctx.createRadialGradient(x - radius * .38, y - radius * .43, radius * .04, x, y, radius * 1.2);
	gradient.addColorStop(0, colors[0]);
	gradient.addColorStop(.48, colors[1]);
	gradient.addColorStop(1, colors[2]);
	drawGlow(ctx, x, y, radius * 2.3, colors[1], .17);
	if (ring) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rotation);
		ctx.strokeStyle = `${colors[0]}88`;
		ctx.lineWidth = Math.max(2, radius * .1);
		ctx.beginPath();
		ctx.ellipse(0, 0, radius * 1.65, radius * .48, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.save();
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.clip();
	ctx.translate(x, y);
	ctx.rotate(rotation * .35);
	ctx.globalAlpha = .2;
	for (let band = -2; band <= 2; band += 1) {
		ctx.fillStyle = band % 2 ? colors[0] : colors[2];
		ctx.fillRect(-radius, band * radius * .34, radius * 2, radius * .11);
	}
	ctx.restore();
}

function drawPlanets(ctx, time) {
	const { width, height } = sceneSize;
	for (const star of sceneStars) {
		const pulse = .45 + .55 * ((Math.sin(time * .001 * star.speed + star.phase) + 1) / 2);
		ctx.fillStyle = `rgba(229, 237, 255, ${.18 + pulse * .5})`;
		ctx.beginPath();
		ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
		ctx.fill();
	}
	drawPlanet(ctx, width * (.73 + Math.sin(time * .00008) * .035), height * .55, Math.min(width, height) * .16, ['#8ce9e4', '#3e81bb', '#1d345d'], time * .00008, true);
	drawPlanet(ctx, width * (.24 + Math.cos(time * .00011) * .025), height * .34, Math.min(width, height) * .09, ['#ffd19a', '#d87868', '#613966'], -time * .0001, false);
	drawPlanet(ctx, width * .47, height * .82, Math.min(width, height) * .045, ['#ded1ff', '#8e6dcb', '#433366'], time * .00013, false);
}

function drawStarflight(ctx, time, progress) {
	const { width, height } = sceneSize;
	const easedProgress = progress * progress * (3 - 2 * progress);
	const routeX = Math.sin(progress * Math.PI * 2.2 + .4) * .48 + Math.sin(progress * Math.PI * 5.1) * .16 + Math.sin(progress * Math.PI * 8.3 + .8) * .08;
	const routeY = Math.cos(progress * Math.PI * 1.8 + .6) * .36 + Math.sin(progress * Math.PI * 4.7 + 1.1) * .17 + Math.cos(progress * Math.PI * 7.4) * .075;
	const turnX = Math.sin(progress * Math.PI * 8.5) * .11;
	const turnY = Math.cos(progress * Math.PI * 7.3) * .1;
	const speedPulse = .72 + .28 * Math.sin(progress * Math.PI * 6 - .8);
	const acceleration = progress < .16 ? progress / .16 : progress > .88 ? (1 - progress) / .12 : 1;
	const speed = Math.max(.13, speedPulse * (.32 + .95 * acceleration));
	const cameraX = routeX + turnX;
	const cameraY = routeY + turnY;
	const centerX = width * (.5 + cameraX * .3);
	const centerY = height * (.5 + cameraY * .3);
	const focalLength = Math.min(width, height) * (.78 + .13 * Math.sin(progress * Math.PI * 2));

	const project = (x, y, z) => ({
		x: centerX + ((x - cameraX * .82) / Math.max(.035, z)) * focalLength,
		y: centerY + ((y - cameraY * .82) / Math.max(.035, z)) * focalLength,
	});

	for (const star of travelStars) {
		star.previousZ = star.z;
		star.z -= (.012 + .008 * (1 - star.z)) * speed;
		if (star.z <= .045) {
			star.z = 1;
			star.previousZ = 1;
			star.x = (seeded(Math.floor(time + star.color.length), Math.round(time / 7)) - .5) * 2;
			star.y = (seeded(Math.floor(time / 2 + star.color.length * 3), Math.round(time / 11)) - .5) * 2;
		}
		const point = project(star.x, star.y, star.z);
		const previousPoint = project(star.x, star.y, star.previousZ);
		if (point.x < -70 || point.x > width + 70 || point.y < -70 || point.y > height + 70) continue;
		const brightness = Math.min(1, (.16 + (1 - star.z) * .92) * speed);
		ctx.strokeStyle = `${star.color}${Math.round(brightness * 175).toString(16).padStart(2, '0')}`;
		ctx.lineWidth = .45 + (1 - star.z) * 2.1;
		ctx.beginPath();
		ctx.moveTo(previousPoint.x, previousPoint.y);
		ctx.lineTo(point.x, point.y);
		ctx.stroke();
		ctx.fillStyle = `${star.color}${Math.round(brightness * 235).toString(16).padStart(2, '0')}`;
		ctx.beginPath();
		ctx.arc(point.x, point.y, .45 + (1 - star.z) * 2.4, 0, Math.PI * 2);
		ctx.fill();
		if (star.z < .45) drawGlow(ctx, point.x, point.y, 7 + (1 - star.z) * 12, star.color, .09 * brightness);
	}

	const planetPalettes = [
		['#d8c5ff', '#8669d6', '#34275f'], ['#b5f3e8', '#378db3', '#16415e'],
		['#ffe1a3', '#d97576', '#5a365e'], ['#c5f0ff', '#638ee0', '#263a72'],
	];
	for (const body of spaceObjects) {
		body.cycle += speed * .0014;
		body.z -= (.004 + .002 * Math.sin(body.cycle * 2)) * speed;
		body.rotation += body.rotationSpeed * 16 * speed;
		if (body.z <= .13) {
			body.z = 1.05 + seeded(Math.floor(time / 17 + body.radius), body.palette) * .45;
			body.x = (seeded(Math.floor(time / 13 + body.radius * 2), body.palette + 3) - .5) * 1.2;
			body.y = (seeded(Math.floor(time / 19 + body.radius * 4), body.palette + 7) - .5) * 1.2;
		}
		const orbitalX = body.x + Math.cos(body.cycle + body.rotation) * .045;
		const orbitalY = body.y + Math.sin(body.cycle * .7 + body.rotation) * .055;
		const point = project(orbitalX, orbitalY, body.z);
		const apparentRadius = Math.max(1.2, body.radius * (.16 + .3 / body.z));
		if (point.x < -apparentRadius * 3 || point.x > width + apparentRadius * 3 || point.y < -apparentRadius * 3 || point.y > height + apparentRadius * 3) continue;
		if (body.kind === 'planet') {
			drawPlanet(ctx, point.x, point.y, apparentRadius, planetPalettes[body.palette], body.rotation, body.ringed);
		} else if (body.kind === 'asteroid') {
			ctx.save();
			ctx.translate(point.x, point.y);
			ctx.rotate(body.rotation);
			const colors = planetPalettes[body.palette];
			const rock = ctx.createLinearGradient(-apparentRadius, -apparentRadius, apparentRadius, apparentRadius);
			rock.addColorStop(0, colors[0]);
			rock.addColorStop(.52, colors[1]);
			rock.addColorStop(1, colors[2]);
			ctx.fillStyle = rock;
			ctx.beginPath();
			for (let vertex = 0; vertex < 8; vertex += 1) {
				const angle = vertex / 8 * Math.PI * 2;
				const radius = apparentRadius * (.72 + seeded(vertex, body.palette + Math.floor(body.rotation * 3)) * .4);
				const x = Math.cos(angle) * radius;
				const y = Math.sin(angle) * radius * .78;
				if (vertex === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		} else {
			const tailX = point.x - Math.cos(body.rotation) * apparentRadius * 3.5;
			const tailY = point.y - Math.sin(body.rotation) * apparentRadius * 3.5;
			const tail = ctx.createLinearGradient(tailX, tailY, point.x, point.y);
			tail.addColorStop(0, 'rgba(0, 0, 0, 0)');
			tail.addColorStop(1, '#b9f1ffcc');
			ctx.strokeStyle = tail;
			ctx.lineWidth = Math.max(1, apparentRadius * .55);
			ctx.beginPath();
			ctx.moveTo(tailX, tailY);
			ctx.lineTo(point.x, point.y);
			ctx.stroke();
			drawGlow(ctx, point.x, point.y, apparentRadius * 2.1, '#b9eaff', .42);
		}
	}

	const portal = project(routeX * .18, routeY * .18, .16 + easedProgress * .46);
	const portalRadius = Math.min(width, height) * (.06 + .12 * (1 - Math.abs(progress - .58)));
	drawGlow(ctx, portal.x, portal.y, portalRadius * 3.3, '#92dfff', .16);
}

function drawStarMap(ctx, time) {
	const { width, height } = sceneSize;
	const drift = time * .000035;
	const sky = ctx.createLinearGradient(0, 0, width * .8, height);
	sky.addColorStop(0, '#070b1a');
	sky.addColorStop(.52, '#10142b');
	sky.addColorStop(1, '#07151b');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);

	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	for (let cloud = 0; cloud < 3; cloud += 1) {
		const x = width * (.2 + cloud * .3) + Math.sin(drift + cloud * 2) * width * .08;
		const y = height * (.28 + cloud * .2) + Math.cos(drift * .8 + cloud) * height * .06;
		const radius = Math.min(width, height) * (.28 + cloud * .04);
		const haze = ctx.createRadialGradient(x, y, 0, x, y, radius);
		haze.addColorStop(0, cloud === 1 ? 'rgba(107, 105, 190, .12)' : 'rgba(59, 149, 171, .09)');
		haze.addColorStop(1, 'rgba(32, 71, 120, 0)');
		ctx.fillStyle = haze;
		ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	}
	ctx.restore();

	const nodes = sceneStars.slice(0, 58).map((star) => ({
		x: (star.x + Math.sin(drift + star.phase) * 11 + width) % width,
		y: (star.y + Math.cos(drift * .73 + star.phase) * 8 + height) % height,
		star,
	}));
	const maxDistance = Math.min(width, height) * .22;
	ctx.save();
	ctx.lineWidth = .65;
	for (let index = 0; index < nodes.length; index += 1) {
		const node = nodes[index];
		let nearest = -1;
		let nearestDistance = maxDistance;
		for (let candidate = index + 1; candidate < nodes.length; candidate += 1) {
			const dx = nodes[candidate].x - node.x;
			const dy = nodes[candidate].y - node.y;
			const distance = Math.hypot(dx, dy);
			if (distance < nearestDistance) {
				nearest = candidate;
				nearestDistance = distance;
			}
		}
		if (nearest < 0) continue;
		const breathe = .5 + .5 * Math.sin(time * .00022 + node.star.phase);
		ctx.strokeStyle = `rgba(150, 203, 236, ${(1 - nearestDistance / maxDistance) * (.055 + breathe * .09)})`;
		ctx.beginPath();
		ctx.moveTo(node.x, node.y);
		ctx.lineTo(nodes[nearest].x, nodes[nearest].y);
		ctx.stroke();
	}
	ctx.restore();

	for (const [index, node] of nodes.entries()) {
		const pulse = .38 + .62 * ((Math.sin(time * .00055 * node.star.speed + node.star.phase) + 1) / 2);
		const radius = node.star.radius * (.72 + pulse * .55);
		if (index % 9 === 0) drawGlow(ctx, node.x, node.y, radius * 9, '#9bdcff', .12 * pulse);
		ctx.fillStyle = `rgba(225, 239, 255, ${.25 + pulse * .7})`;
		ctx.beginPath();
		ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawMeteorShower(ctx, time, progress) {
	const { width, height } = sceneSize;
	const elapsed = progress * sceneDuration;
	const launchInterval = 620;
	const flightDuration = 1500;
	const dustDuration = 2500;
	const launchCount = Math.min(25, Math.floor(elapsed / launchInterval) + 1);
	const sky = ctx.createLinearGradient(0, 0, width * .8, height);
	sky.addColorStop(0, '#050815');
	sky.addColorStop(.58, '#0c1730');
	sky.addColorStop(1, '#101327');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);

	for (let index = 0; index < launchCount; index += 1) {
		const launchTime = index * launchInterval;
		const age = elapsed - launchTime;
		const seed = seeded(index, 243);
		const startX = width * (.12 + seed * .78);
		const startY = height * (.08 + seeded(index, 244) * .55);
		const direction = seed > .5 ? -1 : 1;
		const travelX = width * (.32 + seeded(index, 245) * .34) * direction;
		const travelY = height * (.32 + seeded(index, 246) * .42);
		const flight = Math.min(1, age / flightDuration);
		const headX = startX + travelX * flight;
		const headY = startY + travelY * flight;
		const dustFade = Math.max(0, 1 - age / (flightDuration + dustDuration));

		if (age < flightDuration) {
			const tailX = travelX * .27;
			const tailY = travelY * .27;
			const trail = ctx.createLinearGradient(headX - tailX, headY - tailY, headX, headY);
			trail.addColorStop(0, 'rgba(126, 181, 255, 0)');
			trail.addColorStop(.7, 'rgba(159, 211, 255, .44)');
			trail.addColorStop(1, 'rgba(255, 255, 255, .96)');
			ctx.strokeStyle = trail;
			ctx.lineWidth = 1.8 + seed * 2.2;
			ctx.beginPath();
			ctx.moveTo(headX - tailX, headY - tailY);
			ctx.lineTo(headX, headY);
			ctx.stroke();
			drawGlow(ctx, headX, headY, 8 + seed * 7, '#c6e8ff', .62);
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.arc(headX, headY, 1.3 + seed, 0, Math.PI * 2);
			ctx.fill();
		}

		if (dustFade > 0) {
			for (let mote = 0; mote < 30; mote += 1) {
				const moteSeed = seeded(index * 19 + mote, 251);
				const along = Math.max(0, flight - moteSeed * .42);
				const spread = (1 - dustFade) * 9 + moteSeed * 2;
				const x = startX + travelX * along - travelX * .08 * moteSeed + (seeded(mote, index + 258) - .5) * spread;
				const y = startY + travelY * along - travelY * .08 * moteSeed + (seeded(mote, index + 259) - .5) * spread;
				const pulse = .35 + .65 * ((Math.sin(time * .012 + moteSeed * 18) + 1) / 2);
				ctx.fillStyle = `rgba(185, 218, 255, ${dustFade * pulse * .72})`;
				ctx.beginPath();
				ctx.arc(x, y, .35 + moteSeed * 1.15, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

function drawStarLetters(ctx, time, progress) {
	const { width, height } = sceneSize;
	const sky = ctx.createLinearGradient(0, 0, width, height);
	sky.addColorStop(0, '#060a18');
	sky.addColorStop(.55, '#11152d');
	sky.addColorStop(1, '#07151c');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);

	for (const star of sceneStars) {
		const pulse = .3 + .7 * ((Math.sin(time * .0007 * star.speed + star.phase) + 1) / 2);
		ctx.fillStyle = `rgba(198, 219, 255, ${.1 + pulse * .3})`;
		ctx.beginPath();
		ctx.arc(star.x, star.y, star.radius * .7, 0, Math.PI * 2);
		ctx.fill();
	}

	const sceneElapsed = progress * starLetterSceneDuration;
	const morphProgress = Math.max(0, Math.min(1, (sceneElapsed - starLetterHoldDuration) / sceneDuration));
	const letterPosition = morphProgress * (alphabetTargets.length - 1);
	const letterIndex = Math.min(alphabetTargets.length - 2, Math.floor(letterPosition));
	const local = letterPosition - letterIndex;
	const blend = local * local * (3 - 2 * local);
	const from = alphabetTargets[letterIndex];
	const to = alphabetTargets[letterIndex + 1];
	const stars = from.map((point, index) => ({
		x: point.x + (to[index].x - point.x) * blend,
		y: point.y + (to[index].y - point.y) * blend,
		index,
	}));
	const shimmer = .72 + .28 * Math.sin(time * .0012);

	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	ctx.shadowColor = '#82cfff';
	ctx.shadowBlur = 10;
	for (const star of stars) {
		const twinkle = .62 + .38 * ((Math.sin(time * .003 + star.index * 2.1) + 1) / 2);
		const radius = (.8 + seeded(star.index, 267) * 1.5) * twinkle;
		ctx.fillStyle = `rgba(220, 239, 255, ${shimmer * twinkle})`;
		ctx.beginPath();
		ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawCrystalSnowflake(ctx, x, y, radius, rotation, alpha, detailed = false) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rotation);
	ctx.globalAlpha *= alpha;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const ice = ctx.createLinearGradient(-radius, -radius, radius, radius);
	ice.addColorStop(0, '#f8ffff');
	ice.addColorStop(.32, '#d6f4ff');
	ice.addColorStop(.67, '#93d9f4');
	ice.addColorStop(1, '#ffffff');
	ctx.strokeStyle = ice;
	ctx.shadowColor = '#a9e8ff';
	ctx.shadowBlur = detailed ? radius * .42 : radius * .7;
	ctx.lineWidth = Math.max(detailed ? 1 : .55, radius * (detailed ? .025 : .1));

	for (let arm = 0; arm < 6; arm += 1) {
		const angle = arm * Math.PI / 3;
		const endX = Math.cos(angle) * radius;
		const endY = Math.sin(angle) * radius;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(endX, endY);
		ctx.stroke();

		if (detailed) {
			for (const branch of [.42, .66, .84]) {
				const branchX = endX * branch;
				const branchY = endY * branch;
				const branchLength = radius * (branch === .84 ? .14 : .2) * (1 - branch * .28);
				for (const side of [-1, 1]) {
					const branchAngle = angle + side * Math.PI / 3;
					ctx.beginPath();
					ctx.moveTo(branchX, branchY);
					ctx.lineTo(branchX - Math.cos(branchAngle) * branchLength, branchY - Math.sin(branchAngle) * branchLength);
					ctx.stroke();
				}
			}

			const tipLength = radius * .12;
			for (const side of [-1, 1]) {
				ctx.beginPath();
				ctx.moveTo(endX, endY);
				ctx.lineTo(endX - Math.cos(angle + side * Math.PI / 3) * tipLength, endY - Math.sin(angle + side * Math.PI / 3) * tipLength);
				ctx.stroke();
			}
		}
	}

	if (detailed) {
		ctx.shadowBlur = radius * .18;
		ctx.fillStyle = 'rgba(248, 255, 255, .9)';
		ctx.beginPath();
		for (let point = 0; point < 6; point += 1) {
			const angle = point * Math.PI / 3;
			const hexX = Math.cos(angle) * radius * .13;
			const hexY = Math.sin(angle) * radius * .13;
			if (point === 0) ctx.moveTo(hexX, hexY);
			else ctx.lineTo(hexX, hexY);
		}
		ctx.closePath();
		ctx.fill();
		drawGlow(ctx, 0, 0, radius * .32, '#d8f7ff', .52);
	}
	ctx.restore();
}

function drawSnowfall(ctx, time, progress, duration) {
	const { width, height } = sceneSize;
	const elapsed = progress * duration;
	const sky = ctx.createLinearGradient(0, 0, 0, height);
	sky.addColorStop(0, '#07101e');
	sky.addColorStop(.58, '#172b43');
	sky.addColorStop(1, '#253b50');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);

	for (const star of sceneStars.slice(0, 48)) {
		const pulse = .35 + .65 * ((Math.sin(time * .0007 * star.speed + star.phase) + 1) / 2);
		ctx.fillStyle = `rgba(216, 235, 255, ${.1 + pulse * .32})`;
		ctx.beginPath();
		ctx.arc(star.x, star.y * .78, star.radius * .72, 0, Math.PI * 2);
		ctx.fill();
	}

	const approachDuration = 2600;
	const recedeDuration = 3900;
	const snowfallStart = 3600;
	const peakRadius = Math.min(width, height) * .19;
	let heroX = width * .5;
	let heroY = height * .23;
	let heroRadius = peakRadius * .12;
	if (elapsed < approachDuration) {
		const approach = elapsed / approachDuration;
		const eased = approach * approach * (3 - 2 * approach);
		heroX += Math.sin(elapsed * .0012) * width * .025;
		heroY += height * .17 * eased;
		heroRadius = peakRadius * (.12 + eased * .92);
	} else {
		const recede = Math.min(1, (elapsed - approachDuration) / recedeDuration);
		const eased = recede * recede * (3 - 2 * recede);
		heroX += Math.sin(time * .00055) * width * .055 + width * .035 * recede;
		heroY += height * (.17 + .53 * eased);
		heroRadius = peakRadius * (1.04 - .76 * eased);
	}
	drawCrystalSnowflake(ctx, heroX, heroY, heroRadius, time * .00042, .98, true);

	if (elapsed > snowfallStart) {
		const snowElapsed = elapsed - snowfallStart;
		const spawnInterval = 520;
		const flakeCount = Math.min(110, Math.floor(snowElapsed / spawnInterval) + 1);
		for (let index = 0; index < flakeCount; index += 1) {
			const seed = seeded(index, 319);
			const birth = index * spawnInterval;
			const age = snowElapsed - birth;
			const speed = height * (.000025 + seeded(index, 320) * .000035);
			const fallDistance = height + 40;
			const cycleDuration = fallDistance / speed;
			const cycleAge = age % cycleDuration;
			const startY = -12 - (age >= cycleDuration ? (Math.floor(age / cycleDuration) * 13) % height : 0);
			const y = startY + cycleAge * speed;
			const x = ((seed * width + Math.sin(age * .0008 + seed * 12) * width * .035 + width) % width);
			const depth = .35 + seeded(index, 321) * .65;
			const radius = 1.1 + depth * 2.4;
			const fadeIn = Math.min(1, age / 650);
			drawCrystalSnowflake(ctx, x, y, radius, age * (.00025 + depth * .00022), fadeIn * (.46 + depth * .42), depth > .78);
		}
	}
}

function drawSceneFrame(ctx, index, time, alpha, progress, duration = sceneDuration) {
	ctx.save();
	ctx.globalAlpha = alpha;
	switch (index) {
		case 0: drawSnowfall(ctx, time, progress, duration); break;
		case 1: drawAurora(ctx, time); break;
		case 2: drawCatAurora(ctx, time); break;
		case 3: drawFireflies(ctx, time); break;
		case 4: drawMoonlight(ctx, time); break;
		case 5: drawPlanets(ctx, time); break;
		case 6: drawStarflight(ctx, time, progress); break;
		case 7: drawStarMap(ctx, time); break;
		case 8: drawMeteorShower(ctx, time, progress); break;
		case 9: drawStarLetters(ctx, time, progress); break;
		default: drawAurora(ctx, time);
	}
	ctx.restore();
}

function renderScene(time) {
	const ctx = sceneCanvas.getContext('2d');
	if (!ctx || !sceneSize.width || !sceneSize.height) return;
	const { width, height, ratio } = sceneSize;
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = '#050807';
	ctx.fillRect(0, 0, width, height);
	const cycleDuration = sceneNames.reduce((total, _name, index) => total + getSceneDuration(index), 0);
	let local = Math.max(0, time - sceneStartedAt) % cycleDuration;
	let current = 0;
	while (current < sceneNames.length - 1) {
		const duration = getSceneDuration(current);
		if (local < duration) break;
		local -= duration;
		current += 1;
	}
	const currentDuration = getSceneDuration(current);
	const progress = local / currentDuration;
	sceneCanvas.dataset.scene = sceneNames[current];
	const fade = sceneReducedMotion ? 0 : sceneFadeDuration;
	if (local < fade) {
		const previous = (current + sceneNames.length - 1) % sceneNames.length;
		const previousDuration = getSceneDuration(previous);
		const previousProgress = 1 - (fade - local) / previousDuration;
		drawSceneFrame(ctx, previous, time, 1 - local / fade, previousProgress, previousDuration);
	}
	drawSceneFrame(ctx, current, time, fade && local < fade ? local / fade : 1, progress, currentDuration);
	if (fade && local > currentDuration - fade) {
		const next = (current + 1) % sceneNames.length;
		drawSceneFrame(ctx, next, time, (local - (currentDuration - fade)) / fade, 0, getSceneDuration(next));
	}
}

function drawScene(time) {
	if (!roomJoined) {
		sceneFrame = 0;
		return;
	}
	renderScene(time);
	if (!sceneReducedMotion && !document.hidden && roomJoined) sceneFrame = requestAnimationFrame(drawScene);
	else sceneFrame = 0;
}

function clearScene() {
	const ctx = sceneCanvas.getContext('2d');
	if (!ctx) return;
	ctx.setTransform(sceneSize.ratio, 0, 0, sceneSize.ratio, 0, 0);
	ctx.clearRect(0, 0, sceneSize.width, sceneSize.height);
	ctx.fillStyle = '#050807';
	ctx.fillRect(0, 0, sceneSize.width, sceneSize.height);
	delete sceneCanvas.dataset.scene;
}

const sceneResizeObserver = new ResizeObserver(resizeSceneCanvas);
sceneResizeObserver.observe(document.querySelector('.message-stage'));
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
	sceneReducedMotion = event.matches;
	cancelAnimationFrame(sceneFrame);
	sceneFrame = 0;
		if (roomJoined) drawScene(performance.now());
});
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		cancelAnimationFrame(sceneFrame);
		sceneFrame = 0;
	}
	else if (roomJoined && !sceneReducedMotion) drawScene(performance.now());
});
resizeSceneCanvas();

function getBackendUrl() {
	return window.location.origin;
}

function setConnected(connected) {
	roomJoined = connected;
	profilePrompt.hidden = connected;
	leaveButton.hidden = !connected;
	messageForm.hidden = !connected;
	messageInput.disabled = !connected;
	sendButton.disabled = !connected;
	stickerToggle.disabled = !connected;
	if (!connected) {
		cancelAnimationFrame(sceneFrame);
		sceneFrame = 0;
		clearScene();
		document.querySelector('.chat-layout').classList.remove('joined');
	}
	if (connected) {
		sceneStartedAt = performance.now();
		document.querySelector('.chat-layout').classList.add('joined');
		drawScene(sceneStartedAt);
		messageInput.focus();
	}
}

function clearMessages() {
	messageList.querySelectorAll('.chat-message').forEach((message) => message.remove());
	messageList.querySelectorAll('.system-message').forEach((message) => message.remove());
	messageIds.clear();
	emptyState.hidden = false;
}

function showBanner(message) {
	connectionBanner.textContent = message;
	connectionBanner.hidden = !message;
}

function leaveRoom(notice = '') {
	if (socket?.connected) {
		socket.emit('typing:set', false);
		socket.emit('room:leave');
	}
	usernameInput.value = username;
	updateAvatarPreview(avatarUrl);
	messageInput.value = '';
	username = '';
	typing = false;
	clearTimeout(typingTimer);
	typingIndicator.hidden = true;
	stickerPicker.hidden = true;
	stickerToggle.setAttribute('aria-expanded', 'false');
	setConnected(false);
	showBanner(notice);
	usernameInput.focus();
}

function appendMessage(message) {
	if (messageIds.has(message.id)) return;
	messageIds.add(message.id);
	emptyState.hidden = true;
	if (message.type === 'system') {
		const notice = document.createElement('div');
		notice.className = 'system-message';
		const label = document.createElement('span');
		label.textContent = message.text;
		const time = document.createElement('time');
		time.dateTime = message.sentAt;
		const sentAt = new Date(message.sentAt);
		time.textContent = Number.isNaN(sentAt.getTime()) ? '' : sentAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
		notice.append(label, time);
		messageList.append(notice);
		messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'instant' });
		return;
	}

	const row = document.createElement('article');
	row.className = `chat-message${message.username === username ? ' own' : ''}`;
	const avatar = document.createElement('div');
	avatar.className = 'message-avatar';
	avatar.setAttribute('aria-hidden', 'true');
	if (message.avatarUrl) {
		const image = document.createElement('img');
		image.src = message.avatarUrl;
		image.alt = '';
		avatar.append(image);
	} else {
		avatar.textContent = Array.from(message.username)[0]?.toUpperCase() || '?';
	}
	const content = document.createElement('div');
	content.className = 'message-content';
	const meta = document.createElement('div');
	meta.className = 'message-meta';
	const name = document.createElement('span');
	name.className = 'message-name';
	name.textContent = message.username;
	const time = document.createElement('time');
	time.className = 'message-time';
	const sentAt = new Date(message.sentAt);
	time.dateTime = message.sentAt;
	time.textContent = Number.isNaN(sentAt.getTime()) ? '' : sentAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
	const bubble = document.createElement('div');
	bubble.className = 'message-bubble';
	if (message.type === 'sticker') {
		bubble.classList.add('sticker-bubble');
		bubble.textContent = message.sticker;
	} else {
		bubble.textContent = message.text;
	}
	meta.append(name, time);
	content.append(meta, bubble);
	row.append(avatar, content);
	messageList.append(row);
	messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'instant' });
}

function handleHistory(messages) {
	if (!messages.length) clearMessages();
	for (const message of messages) appendMessage(message);
}

function connectToRoom(selectedAvatar) {
	avatarUrl = selectedAvatar;
	profilePrompt.hidden = true;
	joinError.hidden = true;
	showBanner('Xonaga ulanmoqda…');

	const join = () => {
		socket.emit('room:join', { username, avatarUrl });
	};
	if (socket?.connected) {
		join();
		return;
	}
	if (socket) socket.disconnect();
	socket = window.io(getBackendUrl(), { autoConnect: false });
	socket.on('connect', join);
	socket.on('chat:history', handleHistory);
	socket.on('chat:reset', () => {
		clearMessages();
		showBanner('Xona bo‘shadi. Suhbat tarixi tozalandi.');
	});
	socket.on('members:update', renderMembers);
	socket.on('typing:update', renderTyping);
	socket.on('chat:message', appendMessage);
	socket.on('chat:error', ({ code, maxLength }) => {
		const errors = {
			INVALID_MESSAGE: 'Bo‘sh xabar yuborib bo‘lmaydi.',
			MESSAGE_TOO_LONG: `Xabar ${maxLength} belgidan oshmasligi kerak.`,
			INVALID_STICKER: 'Bu stiker mavjud emas.',
			RATE_LIMITED: 'Biroz sekinroq yozing, keyin yana yuboring.',
		};
		showBanner(errors[code] || 'Xabar yuborilmadi. Qayta urinib ko‘ring.');
	});
	socket.on('connect_error', () => {
		joinError.textContent = 'Serverga ulanib bo‘lmadi. Server ishlayotganini tekshiring.';
		joinError.hidden = false;
		setConnected(false);
		showBanner('');
	});
	socket.on('disconnect', (reason) => {
		if (reason === 'io client disconnect') return;
		setConnected(false);
		showBanner('Ulanish uzildi. Qayta kirib suhbatni davom ettiring.');
	});
	socket.on('room:joined', () => {
		showBanner('');
		setConnected(true);
	});
	socket.connect();
}

function renderMembers(members) {
	membersList.replaceChildren();
	avatarStack.replaceChildren();
	for (const member of members.slice(0, 8)) {
		const avatar = document.createElement('span');
		avatar.className = 'mini-avatar member-avatar-stack-item';
		avatar.title = member.username;
		avatar.setAttribute('aria-label', member.username);
		if (member.avatarUrl) {
			const image = document.createElement('img');
			image.src = member.avatarUrl;
			image.alt = '';
			avatar.append(image);
		} else {
			avatar.textContent = Array.from(member.username)[0]?.toUpperCase() || '?';
		}
		avatarStack.append(avatar);
	}
	for (const member of members) {
		const item = document.createElement('li');
		item.className = 'member-item';
		const name = document.createElement('span');
		name.className = 'member-name';
		name.textContent = member.username;
		item.append(name);
		membersList.append(item);
	}
}

function renderTyping(typingUsers) {
	const visibleUsers = typingUsers.filter((user) => user.id !== socket?.id);
	typingIndicator.hidden = visibleUsers.length === 0;
	typingNames.textContent = visibleUsers.map((user) => user.username).join(', ');
	if (visibleUsers.length === 1) typingNames.append(document.createTextNode(' yozyapti'));
	else if (visibleUsers.length > 1) typingNames.append(document.createTextNode(' yozishyapti'));
}

function setTyping(isTyping) {
	if (!socket?.connected || !roomJoined || typing === isTyping) return;
	typing = isTyping;
	socket.emit('typing:set', isTyping);
}

function resizeAvatar(file) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		const fileUrl = URL.createObjectURL(file);
		image.onload = () => {
			const size = 256;
			const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
			canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
			canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(fileUrl);
			resolve(canvas.toDataURL('image/jpeg', 0.78));
		};
		image.onerror = () => {
			URL.revokeObjectURL(fileUrl);
			reject(new Error('Rasmni o‘qib bo‘lmadi.'));
		};
		image.src = fileUrl;
	});
}

function updateAvatarPreview(source) {
	profilePreview.replaceChildren();
	if (source) {
		const image = document.createElement('img');
		image.src = source;
		image.alt = '';
		profilePreview.append(image);
		avatarChoiceLabel.textContent = 'Profil rasmi tanlandi';
		avatarNo.hidden = false;
		return;
	}
	profilePreview.textContent = '✿';
	avatarChoiceLabel.textContent = 'Profil rasmi ixtiyoriy';
	avatarNo.hidden = true;
}

for (const sticker of stickers) {
	const button = document.createElement('button');
	button.className = 'sticker-option';
	button.type = 'button';
	button.setAttribute('role', 'option');
	button.setAttribute('aria-label', `${sticker} stikerini yuborish`);
	button.textContent = sticker;
	button.addEventListener('click', () => {
		if (!socket?.connected) return;
		setTyping(false);
		socket.emit('chat:send', { type: 'sticker', sticker });
		stickerPicker.hidden = true;
		stickerToggle.setAttribute('aria-expanded', 'false');
		messageInput.focus();
	});
	stickerGrid.append(button);
}

joinForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const requestedName = usernameInput.value.trim();
	if (!requestedName) {
		joinError.textContent = 'Ismingizni kiriting.';
		joinError.hidden = false;
		return;
	}
	if (typeof window.io !== 'function') {
		joinError.textContent = 'Chat serveriga ulanib bo‘lmadi. Sahifani yangilang.';
		joinError.hidden = false;
		return;
	}

	username = requestedName.slice(0, 32);
	connectToRoom(avatarUrl);
});

leaveButton.addEventListener('click', () => leaveRoom('Siz xonadan chiqdingiz. Tarix xonada odam bor ekan saqlanadi.'));
brandButton.addEventListener('click', () => {
	if (roomJoined) messageInput.focus();
	else usernameInput.focus();
});

avatarYes.addEventListener('click', () => avatarFile.click());
avatarNo.addEventListener('click', () => {
	avatarUrl = null;
	updateAvatarPreview(null);
});
avatarFile.addEventListener('change', async () => {
	const [file] = avatarFile.files || [];
	if (!file) return;
	if (!file.type.startsWith('image/')) {
		joinError.textContent = 'Profil uchun rasm faylini tanlang.';
		joinError.hidden = false;
		return;
	}
	try {
		avatarUrl = await resizeAvatar(file);
		updateAvatarPreview(avatarUrl);
	} catch {
		joinError.textContent = 'Rasmni yuklab bo‘lmadi. Boshqa rasm tanlang.';
		joinError.hidden = false;
	}
	avatarFile.value = '';
});

stickerToggle.addEventListener('click', () => {
	stickerPicker.hidden = !stickerPicker.hidden;
	stickerToggle.setAttribute('aria-expanded', String(!stickerPicker.hidden));
});
stickerClose.addEventListener('click', () => {
	stickerPicker.hidden = true;
	stickerToggle.setAttribute('aria-expanded', 'false');
});

messageForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const text = messageInput.value.trim();
	if (!socket?.connected || !text) return;
	setTyping(false);
	socket.emit('chat:send', { text });
	messageInput.value = '';
	messageInput.style.height = 'auto';
	showBanner('');
	messageInput.focus();
});

messageInput.addEventListener('input', () => {
	messageInput.style.height = 'auto';
	messageInput.style.height = `${Math.min(messageInput.scrollHeight, 126)}px`;
	clearTimeout(typingTimer);
	const hasText = messageInput.value.trim().length > 0;
	setTyping(hasText);
	if (hasText) typingTimer = setTimeout(() => setTyping(false), 1800);
});

messageInput.addEventListener('keydown', (event) => {
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		messageForm.requestSubmit();
	}
});