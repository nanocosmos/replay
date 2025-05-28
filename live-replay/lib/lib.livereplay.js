/**
 * Live Replay Helper
 * (c) nanocosmos GmbH 2024
 */

/**
 * @typedef CONFIG
 * @type {Object}
 * @property {boolean} USEORGA - Indicates whether to use organization-specific URLs.
 * @property {string} PAGE_ROOT - The root URL of the page.
 * @property {boolean} DEBUG - Flag for enabling or disabling debug mode.
 * @property {string} BUCKET_URL - The base URL for the bucket.
 */

const

	VERSION = "1.23.0",

	/**
	 * @type {CONFIG}
	 */

	DEFAULT_CONFIG = {
		BUCKET_URL: "https://bintu-vod.nanocosmos.de/vod/replay",
		PAGE_ROOT: window.location.protocol + "//" + window.location.host,
		PAGE_PATH: "live-replay/replayer",
		EMBED_PATH: "live-replay/replayer",
		DEBUG: true,
		USEORGA: false
	};


/**
 * A function to decode the Share URL
 * @param {String}  encodedParameter
 * @returns {{cueIn: number, cueOut: number, streamName: string, session: string}|{}}
 */

function decodeShareUrl(encodedParameter) {

	try {

		let
			[streamName, cueIn, cueOut, session] =
				atob(encodedParameter).split("|");

		if (streamName.length > 128) throw "error";

		cueIn = parseFloat(cueIn);
		cueOut = parseFloat(cueOut);

		if (isNaN(cueIn) || isNaN(cueOut)) throw "error";
		if (cueOut < cueIn + 5) cueOut = cueIn + 5;

		session = Number.parseInt(session, 10) || undefined;
		return {streamName, cueIn, cueOut, session};

	} catch (e) {
	}

	return {}
}

/**
 * Obtains the Session Timestamp from a Playlist Filename
 * @param {string} timestampedFilenameOrSessionId A string with the Session Timestamp,  or the full Playlist filename
 * @returns {number|undefined} The numeric Session Timestamp
 */

function getSessionFromFilename(timestampedFilenameOrSessionId) {

	const

		finalSessionTimestamp = timestampedFilenameOrSessionId
			? timestampedFilenameOrSessionId.endsWith(".m3u8")
				? timestampedFilenameOrSessionId.split(".m3u8")[0].split("-")[2]
				: timestampedFilenameOrSessionId
			: "0"

	return parseInt(finalSessionTimestamp, 10) || undefined;
}

/**
 *
 * The Nanocosmos Live Replay Service, that provides methods to obtain relevant URLs to interface the service.
 *
 * @param {string} streamName - The stream name to get the playlist for.
 * @param {CONFIG} [CONFIG=DEFAULT_CONFIG] - Configuration object.
 * @returns {{getHlsUrl: (function(number=, string=): string), getFFMPEGCommandLine: (function(number, number, *): string|string), getShareUrl: (function(number, number, number): string|string), getSegmentCutout: ((function(number, number, *): ({startSegment: number, endSegment: number, startOffset: number, duration: number}|null))|*), getSegmentForTime: ((function(number, Hls): number)|*), load: (function(number=): Promise<{streamName?: string, data?: Object, url?: String, error?: Error}>), findBestHlsUrl: ((function(number): Promise<string>)|*), getEmbedUrl: ((function(number, number, number): string)|*)}} * @constructor
 */

function LiveReplay(streamName, CONFIG = DEFAULT_CONFIG) {

	if (!streamName) throw new Error("Streamname must be provided");

	const

		// Whether the provided streamname is a virtual ABR streamname
		isNativeAbr = streamName.endsWith("-abr"),
		// In such a case - this would be the real (PT) streamname
		processedStreamName = isNativeAbr ? streamName.split("-abr")[0]: streamName,

		TAG = "[LiveReplay:" + processedStreamName + "]";

	let
		state;

	if (CONFIG.PAGE_ROOT.endsWith("/"))
		CONFIG.PAGE_ROOT = CONFIG.PAGE_ROOT.substring(0, CONFIG.PAGE_ROOT.length - 1);

	/**
	 * Composes the base URL from the relative path.
	 * @param {string} relativePath - The relative path to append.
	 * @returns {string} The composed base URL.
	 */

	function _getBaseUrl(relativePath) {

		const
			organization = processedStreamName.split("-")[0];

		if (CONFIG.USEORGA) return `${CONFIG.BUCKET_URL}/${organization}` + (relativePath ? "/" + relativePath : "");

		return `${CONFIG.BUCKET_URL}` + (relativePath ? "/" + relativePath : "");
	}

	/**
	 * Gets the HLS Playlist URL.
	 * @param {number?} sessionTimestamp If provided - will return the timestamped playlist filename
	 * @param {string?} suffix Can be "-abr" for an ABR playlist, else just dont provide it.
	 * @returns {string} The HLS Playlist URL.
	 */

	function getHlsUrl(sessionTimestamp, suffix = undefined) {
		return _getBaseUrl(`${processedStreamName}${suffix || ""}${sessionTimestamp ? "-" + sessionTimestamp : ""}.m3u8`);
	}

	/**
	 * Gets the HLS URL associated with the streamname, respecting -abr if this controller was created
	 * with a stream like "****-abr"
	 *
	 * @param {number} sessionTimestamp An ABR or Regular Timestamp
	 * @returns {string}
	 */

	function getResolvedHlsUrl(sessionTimestamp) {
		return getHlsUrl(sessionTimestamp, isNativeAbr ? "-abr":"");
	}

	/**
	 * Gets the LiveShare URL for a time interval.
	 * @param {number} cueInTime - The start time of the interval.
	 * @param {number} cueOutTime - The end time of the interval.
	 * @param {number} sessionTimestamp - The session timstamp
	 * @returns {string} The LiveShare URL.
	 */

	function getShareUrl(cueInTime, cueOutTime, sessionTimestamp) {

		return cueInTime >= 0 && cueOutTime && cueOutTime > cueInTime
			? `${CONFIG.PAGE_ROOT}/${CONFIG.PAGE_PATH}?share=${btoa(`${streamName}|${cueInTime}|${cueOutTime}|${sessionTimestamp || ""}`).split("=")[0]}`
			: "";
	}

	/**
	 * Returns the Best playlist available for this streamname. Will be a single-stream playlist or
	 * an ABR playlist with the different transcoding qualities as specified in Bintu when first
	 * creating the stream.
	 * @param {number} abrSessionTimestamp The Session Timestamp
	 * @returns {Promise<string>} The URL to the best playlist for the provided streamname.
	 */

	async function findBestHlsUrl(abrSessionTimestamp) {

		try {

			const
				url = getHlsUrl(abrSessionTimestamp, "-abr"),
				playlistResponse = await fetch(url),
				playlist = await playlistResponse.text();

			if (playlist && playlist.indexOf("#EXT") >= 0) return url;

		} catch (e) {
			console.log(TAG, "- ABR Playlist: Does not exist.");
		}

		// Fall-back to a regulare playlist
		return getHlsUrl(abrSessionTimestamp);

	}

	/**
	 * Gets the Embed URL for a time interval.
	 * @param {number} cueInTime - The relative start time of the interval in seconds.
	 * @param {number} cueOutTime - The relative end time of the interval in seconds.
	 * @param {number} sessionTimestamp - The playlist session timestamp
	 * @returns {string} The Replay Embed URL.
	 */

	function getEmbedUrl(cueInTime, cueOutTime, sessionTimestamp) {

		if (!cueInTime && !cueOutTime) return "";
		if (!sessionTimestamp) return "";

		const
			from = new Date(parseFloat(cueInTime) * 1000 + parseInt(sessionTimestamp)).toISOString(),
			to = new Date(parseFloat(cueOutTime) * 1000 + parseInt(sessionTimestamp)).toISOString();

		return cueInTime >= 0 && cueOutTime >= 0 && cueOutTime > cueInTime
			? `${CONFIG.PAGE_ROOT}/${CONFIG.EMBED_PATH}?streamname=${streamName}&from=${from}&to=${to}&session=${sessionTimestamp}`
			: "";
	}


	/**
	 * Gets the FFMPEG Command Line to extract a specific interval from the current playlist.
	 * @param {number} cueInTime - The start time of the interval in seconds.
	 * @param {number} cueOutTime - The end time of the interval in seconds.
	 * @param sessionTimestamp
	 * @returns {string} A curated FFMPEG command line that can be used to extract video in the desired interval
	 */

	function getFFMPEGCommandLine(cueInTime, cueOutTime, sessionTimestamp) {

		return cueInTime >= 0 && cueOutTime && cueOutTime > cueInTime && processedStreamName
			? `ffmpeg -ss ${cueInTime.toFixed(3)} -to ${cueOutTime.toFixed(3)} -i ${getResolvedHlsUrl(sessionTimestamp)} -c copy -y shared.mp4`
			: "";
	}

	/**
	 * Gets the segment number for a time
	 * @param {number} time time in seconds
	 * @param {Hls} hlsPlayer The HLS.JS instance
	 * @returns {number}
	 */

	function getSegmentForTime(time, hlsPlayer) {

		const level = hlsPlayer.levels[0]; // Access the first quality level
		if (!level) return -1;

		const segments = level.details.fragments;

		let liveStartIndex = -1;
		let currentTime = 0;

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			if (currentTime <= time && time < currentTime + segment.duration) {
				liveStartIndex = i;
				break;
			}
			currentTime += segment.duration;
		}

		return liveStartIndex;
	}

	/**
	 * Gets the Segment interval and offsets for a specified cueIn + cueOut
	 *
	 * @param {number} cueIn Cue-In time in Seconds
	 * @param {number} cueOut Cue-Out time in Seconds
	 * @param hlsPlayer
	 * @returns {{startSegment: number, endSegment: number, startOffset: number, duration: number}|null}
	 */
	function getSegmentCutout(cueIn, cueOut, hlsPlayer) {
		const level = hlsPlayer.levels[0]; // Access the first quality level
		if (!level) return null;

		const segments = level.details.fragments;

		let currentTime = 0;
		let startSegment = -1;
		let endSegment = -1;
		let startOffset = 0;
		let endOffset = 0;

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];

			if (startSegment === -1 && currentTime + segment.duration > cueIn) {
				startSegment = i;
				startOffset = cueIn - currentTime;
			}

			if (endSegment === -1 && currentTime + segment.duration >= cueOut) {
				endSegment = i;
				endOffset = cueOut - currentTime;
				break;
			}

			currentTime += segment.duration;
		}

		if (startSegment === -1 || endSegment === -1) return null;

		const endTime = startOffset + (cueOut - cueIn);

		return {
			startSegment,
			endSegment,
			startOffset,
			endTime
		};
	}

	/**
	 * Parses the X-NANO header that contains the Session Timestamp. This header is generated so the
	 * "current playlist" knows its timestamp. This is used for Sharing the Video - or else the Shared
	 * links would point to different videos.
	 * @param {string} playlistContent Raw playlist in text format
	 * @returns {{file: string, session: number}|{}}
	 * @private
	 */
	function parsePlaylistTimestamp(playlistContent) {
		// Look for the EXT-X-NANO-PLAYLIST tag
		const nanoTagMatch = playlistContent.match(/#EXT-X-NANO-PLAYLIST[:\s]+\s*([^\s]+)/);

		if (nanoTagMatch) {
			const nanoPlaylistFile = nanoTagMatch[1];
			console.log("Detected EXT-X-NANO-PLAYLIST file:", nanoPlaylistFile);

			// Extract session timestamp if needed
			const timestampMatch = nanoPlaylistFile.match(/(\d+)\.m3u8/);
			if (timestampMatch) {
				const session = parseInt(timestampMatch[1], 10);
				console.log("Extracted session timestamp:", session);
				return {file: nanoPlaylistFile, session};
			}

		}
		return {}
	}

	/**
	 * Fetches the HLS Playlist relevant to the streamname and parses the Session ID from inside.
	 * The final user does not need to call this function - or is really needed to start a playback
	 * IF the REAL m3u8 URL is known. This routine is used within this library because it's neccessary
	 * sometimes to decode session timestamps in order to build the m3u8 URL to hand to hls.js. This is
	 * done automatically by the async function findBestHlsUrl.
	 * @returns {Promise<{streamName?: string, data?: Object, url?: String, error?: Error}>} The fetched playlist data.
	 */
	async function fetchPlaylist(sessionTimestamp) {
		try {
			const
				url = getResolvedHlsUrl(sessionTimestamp),
				response = await fetch(url + "?_=" + Date.now()),
				data = await response.text();

			if (CONFIG.DEBUG) console.log(TAG, "Received", data);
			return {streamName: processedStreamName, data, url, ...parsePlaylistTimestamp(data)};

		} catch (error) {
			if (CONFIG.DEBUG) console.error(TAG, "Error fetching HLS Playlist", error);
			return {error};
		}
	}

	/**
	 * Loads the HLS Playlist. This is not required for playing - but it a convenience method
	 * to check that a playlist exists.
	 * @param {number?} sessionTimestamp Timestamp of the playlist to load - defaults to current one
	 * @returns {Promise<{streamName?: string, data?: Object, url?: String, error?: Error}>}
	 */

	async function load(sessionTimestamp) {
		state = await fetchPlaylist(sessionTimestamp);

		if (CONFIG.DEBUG) console.log(TAG, "HLS Playlist", state);
		return state;
	}

	return {

		load,

		getHlsUrl,
		getResolvedHlsUrl,
		findBestHlsUrl,
		getShareUrl,
		getFFMPEGCommandLine,
		getSegmentCutout,
		getSegmentForTime,
		getEmbedUrl,
		isNativeAbr
	}

}

export {
	VERSION,
	DEFAULT_CONFIG,
	decodeShareUrl,
	getSessionFromFilename,
	LiveReplay
};
