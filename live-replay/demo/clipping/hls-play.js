/**
 * Hls Player Wrapper
 * Instances HLS.JS and allows to generate share links
 * (c) nanocosmos GmbH 2024
 *
 * @returns {{init: init, setCueIn: setCueIn, setCueOut: setCueOut}}
 * @constructor
 */

/* global Hls */

import {LiveReplay, getSessionFromFilename} from "../../lib/lib.livereplay.js";

const
	MINLEN = 2,
	UTC = false;

let

	cueInTime = null,
	cueOutTime = null,
	currentFragment,
	currentFragmentTimestamp,

	video,

	hls,
	liveReplay,
	liveReplayHlsUrl,

	timer;

const

	TAG = "[PVR]",

	/*
	The HLS.JS Player configuration has a lot of settings.
	These are provided for reference
	*/

	HLSOPTIONS = {

		enableWorker: true,                 // Use a worker (separate thread for decoding)

		maxBufferSize: 0,                   // Setting to 0 allows buffer to grow until maxMaxBufferLength
		maxBufferLength: 600,               // Set to at least one segment length
		maxMaxBufferLength: 1200,           // Allow buffer to store up to 5 segments
		maxBufferHole: 1,                   // Tolerate gaps of up to 0.5 seconds
		startLevel: 0,

		maxRetry: 5,						// Maximum number of retries
		retryDelay: 1000,                   // Delay between retries in milliseconds
		maxRetryDelay: 10000,               // Maximum delay between retries

		startFragPrefetch: true,
		debug: true
	},

	stream = _getQueryVariable("streamname");

let sessionTimestamp;


function setCueIn(time) {
	if (time === null) cueInTime = null;
	else cueInTime = time >= 0 ? time : video.currentTime;

	document.getElementById('start-time').value = cueInTime !== null ? formatTime(cueInTime, sessionTimestamp) : "";
	refreshShareUrl();
}

function setCueOut(time) {
	if (time === null) cueOutTime = null;
	else {
		const currentTime = time >= 0 ? time : video.currentTime;
		if (cueInTime !== null && currentTime <= cueInTime + MINLEN) {
			alert("Cue Out time must be after Cue In time. Minimum length is " + MINLEN + " seconds.");
			return;
		}
		cueOutTime = currentTime;
	}

	document.getElementById('end-time').value = cueOutTime !== null ? formatTime(cueOutTime, sessionTimestamp) : "";
	refreshShareUrl();
}

/**
 * Segments have timestamp in seconds
 * @param segment
 * @returns {number}
 */

function getSegmentTimestamp(segment) {
	const time = Number.parseInt(segment.relurl.split("-").pop().split(".ts")[0], 10) || 0;
	return time * 1000;
}

function formatTime(seconds, wallclock) {

	if (wallclock) {
		const absoluteTime = new Date(wallclock + seconds * 1000); // Add playback time (seconds) to the start time (wallclock in ms)

		// Format wallclock time (HH:MM:SS)
		const hours = UTC ? absoluteTime.getUTCHours() : absoluteTime.getHours();
		const minutes = UTC ? absoluteTime.getUTCMinutes() : absoluteTime.getMinutes();
		const secs = UTC ? absoluteTime.getUTCSeconds() : absoluteTime.getSeconds();

		// Return formatted time as HH:MM:SS
		return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
	}

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	let timeString = `${minutes}:${secs < 10 ? '0' : ''}${secs}`;

	if (hours > 0) {
		timeString = `${hours}:${minutes < 10 ? '0' : ''}${timeString}`;
	}

	return timeString;
}

function refreshShareUrl() {


	const
		embedUrl = liveReplay.getEmbedUrl(cueInTime, cueOutTime, sessionTimestamp),
		sharedUrl = liveReplay.getShareUrl(cueInTime, cueOutTime, sessionTimestamp),
		ffmpeg = liveReplay.getFFMPEGCommandLine(cueInTime, cueOutTime, sessionTimestamp);

	document.getElementById("url-share").innerText = sharedUrl || "Share URL Will be displayed here";
	document.getElementById("cmd-ffmpeg").innerText = ffmpeg || "FFMPEG Command line will be displayed here";

	let infoText = "";

	if (ffmpeg) {

		infoText = `Total ${formatTime(cueOutTime - cueInTime)}`;
		document.body.classList.add("with-cue");
		document.getElementById("info-time").innerText = infoText;

	} else {
		document.body.classList.remove("with-cue");
	}

	toggleLink("url-share", "share-url-link", sharedUrl);
	toggleLink("url-embed", "embed-url-link", embedUrl);
	toggleLink("cmd-ffmpeg", "ffmpeg-url-link", ffmpeg);

	return sharedUrl;
}


function toggleLink(divId, linkId, url) {
	const div = document.getElementById(divId);
	const link = document.getElementById(linkId);

	if (url) {
		div.style.display = "none";
		link.style.display = "block";
		link.href = url;
		link.innerText = url;
	} else {
		div.style.display = "block";
		link.style.display = "none";
	}
}

function handleFatalError(data) {
	if (data) {
		document.body.classList.add("fatal-error");
		console.error(data.error, data.response, data.frag);
		document.getElementById("status").innerText = "Time: "
			+ data.frag.start.toFixed(1)
			+ " to " + (data.frag.start + data.frag.duration).toFixed(1)
			+ "\n" + data.error.message + ", url " + data.response.url;


	} else {
		document.body.classList.remove("fatal-error");
		document.getElementById("status").innerText = "";
	}
}

function share(customCueIn, customCueOut) {

	if (customCueIn < 0) {
		alert("Video has not been playing enough time to share the selected interval");
		return;
	}

	if (customCueIn >= 0) cueInTime = customCueIn;
	if (customCueOut >= cueInTime) cueOutTime = customCueOut;

	if (cueInTime !== null && cueOutTime !== null) {

		const sharedUrl = refreshShareUrl();
		window.open(sharedUrl, "share");

	} else {
		alert("Please set both Cue In and Cue Out times before sharing.");
	}

}

function getLiveOffset(hls, video) {
	return hls.liveSyncPosition - video.currentTime;
}

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
	console.log("Query variable %s not found", variable);

}

async function init() {

	if (!stream) return;

	hls = new Hls(HLSOPTIONS);


	// obtain Live Replay URL
	liveReplay = new LiveReplay(stream);

	await initTimestamp();

	liveReplayHlsUrl = liveReplay.getResolvedHlsUrl(sessionTimestamp);

	video = document.getElementById('hlsPlayer');

	console.log(TAG, "- HLS Configuration", HLSOPTIONS);
	console.log(TAG, "- HLS URL", liveReplayHlsUrl);

	document.getElementById("cmd-ffmpeg").innerText = liveReplayHlsUrl;

	document.getElementById("cuein").addEventListener("click", () => setCueIn());
	document.getElementById("cueout").addEventListener("click", () => setCueOut());

	document.getElementById("share").addEventListener("click", () => share());
	document.getElementById("share10").addEventListener("click", () => share(0, 10));
	document.getElementById("share30").addEventListener("click", () => share(0, 30));

	document.getElementById("sharelast10").addEventListener("click", () => share(video.currentTime - 10, video.currentTime));
	document.getElementById("sharelast30").addEventListener("click", () => share(video.currentTime - 30, video.currentTime));

	document.getElementById("rew30").addEventListener("click", () => {
		if (video && video.currentTime) {
			const currentTime = video.currentTime;
			video.currentTime = Math.max(0, currentTime - 30);
		}
	});
	document.getElementById("fwd30").addEventListener("click", () => {
		if (video && video.currentTime) {
			const currentTime = video.currentTime;
			const maxTime = video.duration; // Maximum duration of the video
			video.currentTime = Math.min(maxTime, currentTime + 30); // Skip forward 30 seconds, but not beyond the video's duration
		}
	});

	const
		changeHandler = (e, setter, currentValue) => {

			if (!e.target.value) {
				setter(null);
				return;
			}

			const
				parts = e.target.value.trim().split(":").map((s) => Number.parseFloat(s));

			if (parts.length === 3 && sessionTimestamp) {

				const
					[hours, minutes, seconds] = parts,
					startDate = new Date(sessionTimestamp);

				if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
					setter(currentValue);
					e.target.blur();
					return;
				}

				if (UTC) {
					startDate.setUTCHours(hours);
					startDate.setUTCMinutes(minutes);
					startDate.setUTCSeconds(seconds);
				} else {
					startDate.setHours(hours);
					startDate.setMinutes(minutes);
					startDate.setSeconds(seconds);
				}

				const
					offset = startDate.valueOf() - sessionTimestamp;

				if (offset >= 0) {
					setter(offset / 1000);
					e.target.blur();
					return;
				}

			}
			setter(currentValue);
			e.target.blur();
		}

	document.getElementById("start-time").addEventListener("change", (e) => changeHandler(e, setCueIn, cueInTime));
	document.getElementById("end-time").addEventListener("change", (e) => changeHandler(e, setCueOut, cueOutTime));

	// Capture the seek event
	// And try to recover fatal errors

	video.addEventListener('seeking', () => {
		console.log("User has seeked, attempting to start load at new position.");
		handleFatalError(null);
		if (!hls.started) hls.startLoad(video.currentTime);
		if (video.paused) video.play();
	});

	// Check if HLS is supported natively or via hls.js
	if (Hls.isSupported()) {
		hls.loadSource(liveReplayHlsUrl);
		hls.attachMedia(video);
		hls.on(Hls.Events.MANIFEST_PARSED, function () {
			video.play();
		});

		hls.on(Hls.Events.ERROR, function (event, data) {
			if (data.fatal) {
				switch (data.type) {

					case Hls.ErrorTypes.NETWORK_ERROR:
						console.warn(TAG, "NetworkError", data);

						// so data.fatal will be TRUE and ...
						switch (data.details) {

							case Hls.ErrorDetails.FRAG_LOAD_ERROR:      // That's a 404
							case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:    // unreachable-alike

								console.warn("Skipping missing segment due to 404 error:", data.frag);
								handleFatalError(data);

						}

						// This effectively retries the load
						// Discuss why we will not be doing it
						// hls.startLoad();

						break;

					case Hls.ErrorTypes.MEDIA_ERROR:
						console.warn(TAG, "Media Error encountered, trying to recover...");
						hls.recoverMediaError();
						break;
					default:
						hls.destroy();
						break;
				}
			}
		});
		hls.on(Hls.Events.FRAG_CHANGED, function (event, data) {
			currentFragment = data.frag;
			currentFragmentTimestamp = getSegmentTimestamp(currentFragment);
			console.log(TAG, "Fragment ts", new Date(currentFragmentTimestamp).toTimeString());
		});

	} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
		video.src = liveReplayHlsUrl;
		video.addEventListener('loadedmetadata', function () {
			video.play();
		});

	} else {
		console.error(TAG, 'HLS not supported');
	}

	const
		statusLine = document.getElementById("timelive"),
		wallclock = document.getElementById("wallclocktime");

	clearInterval(timer);
	timer = setInterval(() => {

		const
			delayFromRealtime = getLiveOffset(hls, video);

		statusLine.innerText = isNaN(delayFromRealtime)
			? ""
			: delayFromRealtime > 0
				? formatTime(delayFromRealtime) + " from Live"
				: "Edge of Buffer"

		wallclock.innerHTML = formatTime(video.currentTime, sessionTimestamp);


	}, 250);

	refreshShareUrl();

}

async function initTimestamp() {

	const
		sessionTimestampStr = _getQueryVariable("session");

	sessionTimestamp = getSessionFromFilename(sessionTimestampStr);

	if (!sessionTimestamp) {
		const playlistMeta =  await liveReplay.load();
		sessionTimestamp = playlistMeta.session;

	}

}

window.addEventListener('load', init);
