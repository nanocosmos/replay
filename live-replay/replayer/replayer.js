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
	};


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
        shareCode = _getQueryVariable("share"),
		shareParams = decodeShareUrl(shareCode),
        useShareParams = shareParams.streamName && shareParams.session,
		
        streamName = (useShareParams ? shareParams.streamName : _getQueryVariable("streamname")) || 
                      throwErrorWithMessage("URL parameters 'share' or 'streamname' required"),
        liveReplay = new LiveReplay(streamName),
        session = useShareParams ? shareParams.session :  
                  parseInt(_getQueryVariable("session"), 10) || 
                  (await liveReplay.load()).session,
        from = useShareParams ? '' : _getQueryVariable("from"),
        to = useShareParams ? '' : _getQueryVariable("to"),
        fromMs = (session && from) ? new Date(from).valueOf() : NaN,
        toMs = (session && to) ? new Date(to).valueOf() : NaN,
        cueIn = Math.max(MIN_CUE_IN, (useShareParams ? shareParams.cueIn :
                    !isNaN(fromMs) ? (fromMs - session)/1000 : NaN) || MIN_CUE_IN),
        cueOut = Math.max(cueIn + 1, (useShareParams ? shareParams.cueOut :
                    !isNaN(toMs) ? (toMs - session)/1000 : NaN) || MAX_CUE_OUT),
        url = liveReplay.getHlsUrl(session);

        return {
            url,
            session,
            cueIn,
            cueOut
        }
}

function run({url, cueIn, cueOut, session}) {

	if (url && cueIn >= 0 && cueOut && cueIn < cueOut) {
        let
		    started = false;
		const
            getElementById = (id) => document.getElementById(id),

            stripper = getElementById("stripper"),
		    stripHolder = getElementById("stripHolder"),
		    currentTimeDisplay = getElementById('currentTime'),
		    durationDisplay = getElementById('duration'),
			fullScreenButton = getElementById('fullScreenButton'),
			playButton = getElementById('playButton'),
			muteButton = getElementById('muteButton'),
			pauseButton = getElementById('pauseButton'),
			video = getElementById('hlsPlayer'),
			hls = new Hls({
				...HLSOPTIONS,
				maxBufferLength: Math.min(MAX_BUFFER_LENGTH_MAX, Math.round(cueOut - cueIn) + MAX_BUFFER_LENGTH_ADD),
				startPosition: cueIn
			}),

			updateStrip = () => {

				if (currentTimeDisplay && durationDisplay && stripper) {
					currentTimeDisplay.textContent = formatTime(video.currentTime, session);
					let useEndTime = Math.min(cueOut || 0, video.duration);
					durationDisplay.textContent = formatTime(useEndTime, session);
					const percentage = ((video.currentTime - cueIn) / (useEndTime - cueIn)) * 100;
					stripper.style.width = `${percentage}%`;
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
				})
				.catch((e) => {
					console.error(e);
					document.body.classList.remove("loading");
					updateStrip();
				});
		});
        hls.on(Hls.Events.ERROR, (e) => {
			console.error(e);
            if (!started) {
                document.body.classList.remove("loading");
                document.body.classList.add("witherror");
                const errorField = document.getElementById("error");
                if (errorField)
                    errorField.innerText = "Video failed to load";
            }
		});

		video.addEventListener('playing', () => {
			document.body.classList.remove("loading");
			muteButton.innerText = video.muted ? "Unmute" : "Mute";
			started = true;
		});

		video.addEventListener('timeupdate', () => {

			if (started) {
				updateStrip();
				console.log("time", video.currentTime);
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
			() => getElementById("container")
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
