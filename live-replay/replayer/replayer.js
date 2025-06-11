/* global Hls */

import {
	decodeShareUrl,
	LiveReplay
} from "../lib/lib.livereplay.js";

const

	UTC = false,

	MAX_BUFFER_LENGTH_MAX = 300,
	MAX_BUFFER_LENGTH_ADD = 30,
	MIN_CUE_IN = 0,
	MAX_CUE_OUT = 1e12,

	HLSOPTIONS = {
		enableWorker: true,
		maxBufferLength: MAX_BUFFER_LENGTH_MAX,
		maxBufferSize: 0,           // grow until the following
		maxMaxBufferLength: 600,    // 10 minutes abs max buffer
		maxBufferHole: 1,
		startFragPrefetch: true,

		maxRetry: 5,				// Maximum number of retries
		retryDelay: 1000,           // Delay between retries in milliseconds
		maxRetryDelay: 10000        // Max delay
	},

	VIDEO_OBJECT_FOR_FULLSCREEN = (navigator.userAgent||"").indexOf("Safari") > 0 ? "hlsPlayer" : "container";


// Function to parse URL parameters
function _getQueryVariable(variable) {

	const
		query = window.location.search.substring(1),
		vars = query.split("&");

	for (let i = 0; i < vars.length; i++) {
		const pair = vars[i].split("=");
		if (decodeURIComponent(pair[0]) === variable) {
			return decodeURIComponent(pair[1]);
		}
	}
	console.log("URL parameter '%s' not set", variable);
}

function formatTime(seconds, wallclock) {

	if (wallclock) {

		const
			absoluteTime = new Date(wallclock + seconds * 1000), // Add playback time (seconds) to the start time (wallclock in ms)

			// Format wallclock time (HH:MM:SS)
			hours = UTC ? absoluteTime.getUTCHours() : absoluteTime.getHours(),
			minutes = UTC ? absoluteTime.getUTCMinutes() : absoluteTime.getMinutes(),
			secs = UTC ? absoluteTime.getUTCSeconds() : absoluteTime.getSeconds();

		// Return formatted time as HH:MM:SS
		return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
	}

	const
		hours = Math.floor(seconds / 3600),
		minutes = Math.floor((seconds % 3600) / 60),
		secs = Math.floor(seconds % 60);

	let
		timeString = `${minutes}:${secs < 10 ? '0' : ''}${secs}`;

	if (hours > 0) {
		timeString = `${hours}:${minutes < 10 ? '0' : ''}${timeString}`;
	}

	return timeString;
}

async function init() {

	const
		// The SHARE Hashed parameters
		shareCode = _getQueryVariable("share"),

		// The unpacked JSON parameters: session, streamName, cueIn, cueOut
		shareParams = decodeShareUrl(shareCode),

		// Use Share Params: When there is a VALID sharecode (there's a session and a stream name)
		useShareParams = shareParams.streamName,

		sessionOffset = (fromMs, session, defaultValue) => session && fromMs ? !isNaN(fromMs) ? (fromMs - session) / 1000 : defaultValue : defaultValue,

		providedStreamname = useShareParams ? shareParams.streamName : _getQueryVariable("streamname"),

		isNativeAbr = providedStreamname.endsWith("-abr"),

		streamname = isNativeAbr ? providedStreamname.split("-abr")[0] : providedStreamname;

	if (!streamname)
		throwErrorWithMessage("URL parameters 'share' or 'streamname' required");

	if (useShareParams && !shareParams.session)
		throwErrorWithMessage("Cannot share this video");

	const
		liveReplay = new LiveReplay(providedStreamname);

	let
		cueIn, cueOut, session, bestHlsUrl;

	// Obtain session, cueIn, cueOut from either the Share-encoded parameters
	// or the regular QueryString

	if (useShareParams) {

		// These come encoded in the hash

		session = shareParams.session;
		cueIn = shareParams.cueIn;
		cueOut = shareParams.cueOut;
		bestHlsUrl = liveReplay.getResolvedHlsUrl(session);

	} else {


		// UPDATED APPROACH
		// regular queryString uses "from" and "to" as a Javascript ISO Date String rather than the Cue Offsets.
		// Together with the SESSION TIMESTAMP we can obtain the relative cue.


		// PREVIOUS APPROACH:
		//   regular queryString uses "from" and "to" in UTC rather than the Cue Offsets
		//   but we know the SESSION TIMESTAMP so it's just a matter of substracting it to
		//   get (approx) cues.

		// If NO session timestamp is provided - liveReplay.laod will load the CURRENT playlist
		// that will have a timestamp inside

		const
			requestedSession = parseInt(_getQueryVariable("session"), 10);

		if (requestedSession) {
			if (isNativeAbr) {

				// Native ABR (streamname-abr) assumes this
				console.log("- Using session as ABR Session timestamp");
				bestHlsUrl = await liveReplay.findBestHlsUrl(requestedSession);

			} else {
				console.warn("- Cannot auto-find ABR Playlist from a transcode session timestamp");
				bestHlsUrl = liveReplay.getHlsUrl(requestedSession);
			}


		} else {
			// For the current playlist - we can add "-abr"
			console.log("- Current playlist - will look for ABR");
			bestHlsUrl = await liveReplay.findBestHlsUrl();
		}

		session = parseInt(_getQueryVariable("session"), 10) || (await liveReplay.load()).session;
		cueIn = sessionOffset(new Date(_getQueryVariable("from")).valueOf(), session, MIN_CUE_IN);
		cueOut = sessionOffset(new Date(_getQueryVariable("to")).valueOf(), session, MAX_CUE_OUT);

		/* Old convention used raw timestamps on from, like from=18278763784
		cueIn = sessionOffset(parseInt(_getQueryVariable("from"), 10), session, MIN_CUE_IN);
		cueOut = sessionOffset(parseInt(_getQueryVariable("to"), 10), session, MAX_CUE_OUT);
		 */
	}

	// check cueIn and cueOut bounds

	cueIn = Math.max(MIN_CUE_IN, cueIn || MIN_CUE_IN);
	cueOut = Math.max(cueIn + 1, cueOut || MAX_CUE_OUT)

	if (!session) {
		console.warn("Cannot find session information, UTC times will not be displayed");
	}

	return {
		url: bestHlsUrl,
		session,
		cueIn,
		cueOut
	};

}

// Quality Selector Button and Functionality
function addQualitySelector(hls) {

	const qualitySelector = document.createElement("select");
	qualitySelector.id = "qualitySelector";
	qualitySelector.innerHTML = '<option id="autoBitrate" value="-1">Auto</option>'; // Default Auto Quality

	qualitySelector.addEventListener("change", (event) => {
		const level = parseInt(event.target.value, 10);
		hls.currentLevel = level; // Set HLS.js to the selected quality level
	});

	document.querySelector(".controls").appendChild(qualitySelector);

	// Populate quality levels
	hls.on(Hls.Events.MANIFEST_PARSED, () => {

		const levels = hls.levels;

		// sort reverse

		for (let i = levels.length - 1; i >= 0; i--) {
			const level = levels[i];
			const option = document.createElement("option");
			option.value = "" + i;
			option.textContent = `${level.height}p`; // Example: 720p, 480p
			qualitySelector.appendChild(option);
		}

	});
}

function run({url, cueIn, cueOut, session}) {

	if (url && cueIn >= 0 && cueOut && cueIn < cueOut) {
		let
			started = false,
			qualityDisplay,
			qualitySelector;

		const
			$ = (id) => document.getElementById(id),

			stripper = $("stripper"),
			stripHolder = $("stripHolder"),
			currentTimeDisplay = $('currentTime'),
			durationDisplay = $('duration'),
			fullScreenButton = $('fullScreenButton'),
			playButton = $('playButton'),
			muteButton = $('muteButton'),
			pauseButton = $('pauseButton'),
			video = $('hlsPlayer'),
			hls = new Hls({
				...HLSOPTIONS,
				maxBufferLength: Math.min(MAX_BUFFER_LENGTH_MAX, Math.round(cueOut - cueIn) + MAX_BUFFER_LENGTH_ADD),
				startPosition: cueIn
			}),

			maybeSetTextContent = (element, content) => {
				if (element.textContent !== content) element.textContent = content;
			},
			updateStrip = () => {

				if (currentTimeDisplay && durationDisplay && stripper) {
					maybeSetTextContent(currentTimeDisplay, formatTime(video.currentTime, session));
					let useEndTime = Math.min(cueOut || 0, video.duration);
					maybeSetTextContent(durationDisplay, formatTime(useEndTime, session));
					const percentage = ((video.currentTime - cueIn) / (useEndTime - cueIn)) * 100;
					stripper.style.width = `${percentage}%`;
				}

				// current level - cache element
				qualityDisplay = qualityDisplay || $("autoBitrate");
				qualitySelector = qualitySelector || $("qualitySelector");

				if (hls.levels.length > 1) {

					const
						qualityText = `${hls.levels[hls.currentLevel].height}p`,
						newContent = `Auto${qualityText ? " (" + qualityText + ")" : ""}`;

					maybeSetTextContent(qualityDisplay, newContent);

					if (qualitySelector.style.display !== "block") {
						qualitySelector.style.display = "block";
					}

				} else if (qualitySelector.style.display !== "none") {
					qualitySelector.style.display = "none";
				}
			};

		hls.loadSource(url);
		hls.attachMedia(video);
		hls.on(Hls.Events.MANIFEST_PARSED, () => {
			// if (cueIn >= 1) video.currentTime = cueIn;
			video.muted = true;
			video.play()
				.then(() => {

					muteButton.innerText = video.muted ? "Unmute" : "Mute";
					started = true;

					// INVESTIGATE: Throws an error - but seems fake!

					document.body.classList.remove("loading");
					document.body.classList.remove("witherror");
				})
				.catch((e) => {
					console.error(e);
					document.body.classList.remove("loading");
					updateStrip();
				});
		});
		hls.on(Hls.Events.ERROR, (e, details) => {
			console.error(e, details);
			if (!started) {
				document.body.classList.remove("loading");
				document.body.classList.add("witherror");
				const errorField = document.getElementById("error");
				if (errorField)
					errorField.innerText = details?.details || "Video failed to load";
			}
		});

		video.addEventListener('playing', () => {
			document.body.classList.remove("loading");
			muteButton.innerText = video.muted ? "Unmute" : "Mute";
			started = true;
		});

		// Add Quality Selector
		addQualitySelector(hls);

		video.addEventListener('timeupdate', () => {
			if (started) {
				updateStrip();
				if (video.currentTime > cueOut) {
					console.log("PAST CUEOUT!!!")
					video.currentTime = cueIn;
					video.pause();
				}
			}
		});

		video.addEventListener('seeking', () => {

			if (!started)
				return;

			if (video.currentTime < cueIn) {
				video.currentTime = cueIn;
			} else if (video.currentTime > cueOut) {
				video.currentTime = cueOut;
			}
		});

		fullScreenButton.addEventListener('click',
			() => $(VIDEO_OBJECT_FOR_FULLSCREEN)
				.requestFullscreen()
				.finally(() => {
				})
		);

		playButton.addEventListener('click', () => video.play());

		muteButton.addEventListener('click', (e) => {
			video.muted = !video.muted;
			e.target.innerText = video.muted ? "Unmute" : "Mute"
		});

		pauseButton.addEventListener('click', () => video.pause());
		stripHolder.addEventListener('click', (event) => {

			const
				rect = stripHolder.getBoundingClientRect(),
				clickX = event.clientX - rect.left,
				width = rect.width,
				percentage = clickX / width,
				endTime = Math.min(cueOut || 0, video.duration);

			video.currentTime = cueIn + percentage * (endTime - cueIn);

		});

	} else {
		document.body.classList.add("witherror");
		document.body.classList.remove("loading");
	}
}

function throwErrorWithMessage(message) {
	throw new Error(message);
}

window.addEventListener('load', () => {

	init().then(run).catch((e) => {
		document.body.classList.add("witherror");
		document.body.classList.remove("loading");
		const errorField = document.getElementById("error");
		if (errorField)
			errorField.innerText = e.message;
		else
			alert(e.message);
	});
});
