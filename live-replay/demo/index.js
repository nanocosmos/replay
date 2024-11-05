import {LiveReplay, VERSION} from "../lib/lib.livereplay.js";

const
	TAG = "demo";

let
	BINTU_API = "bintu.nanocosmos.de";

let
	_timer,
	_liveReplay,
	_state;

// Function to parse URL parameters
function getQueryVariable(variable) {

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

// loads the playlist to check that it exists
// (no real need to load the playlist - hls.js will do it for us,
// but this way we can just avoid starting everything if the playlist
// does not exist)

async function updateInfo() {
	if (_liveReplay) {
		_state = await _liveReplay.load();
		document.documentElement.classList
			.toggle("invalidstream", !_state || !_state.url);
	}
}

// right pane (h5live player)
function playVideo(stream, token) {

	const
		iframe = document.getElementById("iframe");

	iframe.style.display = "block";
	iframe.src = `nanoplay/nano-play.html?streamname=${stream}&bintu=${BINTU_API}&jwtoken=${token}`;
	document.documentElement.classList.add("withstream");

}

// show the PVR iframe
function showPVR(streamname, sessionTimestamp = 0) {

	const
		iframe = document.getElementById("pvrFrame");

	if (streamname) {
		iframe.style.display = "block";
		iframe.src = `clipping/hls-play.html?streamname=${streamname}&session=${sessionTimestamp}`;
	} else {
		iframe.style.display = "none";
		iframe.src = "about:blank";
	}
}

// debounce run stream
function postRunStream(stream) {

	clearTimeout(_timer);

	if (stream && stream.length >= 11)
		_timer = setTimeout(runStream, 500, stream);

}

// runs one stream: loads it in the video players
async function runStream(stream) {

	clearTimeout(_timer);

	// Update button initially
	if (stream) {

		_liveReplay = new LiveReplay(stream);

		await updateInfo();

		const
			token = getQueryVariable("jwtoken") || "";

		playVideo(stream, token);

		if (_state.url) {
			showPVR(stream, _state.session);
			document.getElementById("error").innerText = "";
		} else {
			showPVR(null);
			document.getElementById("error").innerText = "There are no clips available for the supplied stream. Please double-check it has been written correctly, wait a few moments, or try again later.";
			_timer = setTimeout(runStream, 10000, stream);
		}

		// support CMD+R to reload current stream
		window.history.replaceState(undefined, undefined, "?streamname=" + stream + "&bintu=" + BINTU_API+(token?"&jwtoken="+token:""));

	}
}

function demo() {

	BINTU_API = getQueryVariable("bintu") || BINTU_API;

	const
		initial = getQueryVariable("streamname") || "";

	document.getElementById("package-version").innerText = `Version ${VERSION}`;
	document.getElementById("streamNameInput").value = initial;
	document.getElementById("streamNameInput")
		.addEventListener("input", (e) => postRunStream(e.target.value));

	if (initial) postRunStream(initial);

}

window.addEventListener('load', demo);
