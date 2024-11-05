
# Live Replay API Documentation

## `LiveReplay` Class

The Live Replay Service class provides methods to obtain relevant URLs to interface the service.

### Example Usages

#### Examples for the current playlist

```javascript
// import the library
import {LiveReplay} from "lib/lib.livereplay.js"

// Replace with your bintu stream name
const streamName = "XXXXX-YYYYY";

// Create Replay Instance
const liveReplay = new LiveReplay(streamName);

// This is the URL of the current playlist that you will feed the HLS player with
console.log("HLS Playlist URL:", liveReplay.getHlsUrl());

// This generates a Embed URL for the specified Cue IN and Cue Out of the CURRENT playlist
console.log("Share URL:", liveReplay.getEmbedUrl(10, 60));

// This generates a Share URL for the specified Cue IN and Cue Out of the CURRENT playlist
console.log("Share URL:", liveReplay.getShareUrl(10, 60));

// This generates a FFMPEG command you can run to extract a video
console.log("FFMPEG Command:", liveReplay.getFFMPEGCommandLine(10, 60));

// Load current playlist metadata, and obtain its URL and Session ID
liveReplay.load().then(({url, session}) => {
	console.log("- Current Playlist URL", url);
	console.log("- Current Playlist Session", session);
});

```

#### Examples for past playlists

You need to know the Playlist Session ID to a specific playlist in the past.


```javascript
// import the library
import {LiveReplay} from "lib/lib.livereplay.js"

// Replace with your bintu stream name
const streamName = "XXXXX-YYYYY";

// Create Replay Instance
const liveReplay = new LiveReplay(streamName);

// This is the URL of the current playlist that you will feed the HLS player with
console.log("HLS URL:", liveReplay.getHlsUrl(session));

// This generates a Embed URL for the specified Cue IN and Cue Out of the CURRENT playlist
console.log("Share URL:", liveReplay.getEmbedUrl(10, 60, session));

// This generates a Share URL for the specified Cue IN and Cue Out of the CURRENT playlist
console.log("Share URL:", liveReplay.getShareUrl(10, 60, session));

// This generates a FFMPEG command you can run to extract a video
console.log("FFMPEG Command:", liveReplay.getFFMPEGCommandLine(10, 60, session));

// Load current playlist metadata, and obtain its URL and Session Id
// Quite redundant as we already have the timestamp - but can be used to
// check that the playlist exists:

liveReplay.load(sessionId).then(({url, session}) => {
	console.log("- Current Playlist URL", url);
	console.log("- Current Playlist Session Id", session); // will be session
});

```

### Constructor

```javascript
LiveReplay(streamName, CONFIG = DEFAULT_CONFIG)
```

### Parameters

- `streamName` (string): The stream name to get the playlist for.
- `CONFIG` (object, optional): The configuration object. Defaults to `DEFAULT_CONFIG`.

### Methods

#### `getHlsUrl(session: number?)`

Gets the HLS Playlist URL associated to the stream and start timestamp.

**Parameters**

- `session` (number, optional): The playlist session, if provided, will return the URL of that specific playlist. Otherwise it returns the URL of the current playlist.

**Returns**

- `string`: The HLS Playlist URL.

#### `getEmbedUrl(cueInTime, cueOutTime, session)`

Gets the Demo Embed URL for a time interval.

**Parameters**

- `cueInTime` (number): The start time of the interval.
- `cueOutTime` (number): The end time of the interval.
- `session` (number, optional): The playlist session, if provided, will return the URL of that specific playlist. Otherwise it returns the URL of the current playlist.

**Returns**

- `string`: The LiveShare URL.


#### `getShareUrl(cueInTime, cueOutTime, session)`

Gets the LiveShare URL for a time interval.

**Parameters**

- `cueInTime` (number): The start time of the interval.
- `cueOutTime` (number): The end time of the interval.
- `session` (number, optional): The playlist session Id, if provided, will return the URL of that specific playlist. Otherwise it returns the URL of the current playlist.

**Returns**

- `string`: The LiveShare URL.

#### `getFFMPEGCommandLine(cueInTime, cueOutTime, session)`

Gets the FFMPEG Command Line to extract a specific interval from the current playlist.

**Parameters**

- `cueInTime` (number): The start time of the interval.
- `cueOutTime` (number): The end time of the interval.
- `session` (number, optional): The playlist session Id, if provided, will return the URL of that specific playlist. Otherwise it returns the URL of the current playlist.

**Returns**

- `string`: The FFMPEG command line.

#### `load(session: number?)`

Loads the HLS Playlist and related metadata.

**Parameters**

- `session` (number, optional): The playlist session Id, if provided, will return the URL of that specific playlist. Otherwise it returns the URL of the current playlist.

**Returns**

A promise to an object with the following fields:

- `Promise<{streamName?: string, session?: number, data?: Object, url?: String, error?: Error}>`: The loaded playlist data.

    - `streamName`: the playlist streamName
    - `url`: the playlist URL
    - `session`: the playlist session Id

#### Other utility functions

##### `decodeShareUrl` Function

This function is meant to be called by the Share Page, in order to decode the encoded URL parameter.

**Parameters**

- `encodedParameter` (string): The encoded parameter from the share URL.

**Returns**

An object containing:
- `cueIn` (number): The relative start time of the interval.
- `cueOut` (number): The relative end time of the interval.
- `streamName` (string): The name of the stream.
- `session` (string): The playlist session Id

Or an empty object if decoding fails.

## Configuration

### CONFIG Type Definition

The `CONFIG` type is an object with the following properties:

- `USEORGA` (boolean): Indicates whether to use organization-specific URLs.
- `PAGE_ROOT` (string): The root URL of the page.
- `DEBUG` (boolean): Flag for enabling or disabling debug mode.
- `BUCKET_URL` (string): The base URL for the bucket.

### Default Configuration

The default configuration defines the storage bucket of the video files, provided by nanocosmos,
and the location and path of your Video Share page

```javascript
const DEFAULT_CONFIG = {
    BUCKET_URL: "https://bintu-vod.nanocosmos.de/vod/replay",
    PAGE_ROOT: window.location.protocol + "//" + window.location.host,
    PAGE_PATH: "live-replay/replayer",
	EMBED_PATH: "live-replay/replayer",
    DEBUG: true
};
```
