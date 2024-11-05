# nanoStream Live Replay
(c) 2024 nanocosmos gmbh, https://www.nanocosmos.de/terms

Take a running live stream to nanoStream Cloud and replay any part of the clip!

## Prerequisites

- You need an active account for nanoStream Cloud (https://info.nanocosmos.de/ or https://dashboard.nanostream.cloud)
- The option "Live Processing / Replay" needs to be enabled for your [organization](https://dashboard.nanostream.cloud/organisation)

## Getting started

### 1. Enable Replay option for a stream
- Enable the "Live Processing / Replay" option when creating a new stream
- Enable the "Live Processing / Replay" option on an existing stream stream
- Documentation: https://docs.nanocosmos.de/docs/cloud-frontend-v3/Dashboard_Live_Processing

### 2. Ingest

Choose your preferred ingest protocol - RTMP, SRT or WebRTC.

#### RTMP

Setup your [encoder and create a Bintu stream](https://docs.nanocosmos.de/docs/cloud/cloud_getting_started).

Example ingest with ffmpeg - you need to replace the stream name `XXXXX-YYYYY`:

`ffmpeg -f lavfi -re -i testsrc -f lavfi -i sine=frequency=1000 -c:a aac -strict -2 -b:a 64k -s 640x480 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -profile:v baseline -g 50 -b:v 500k -f flv rtmp://XXXXX-YYYYY.bintu-vtrans.nanocosmos.de/live/XXXXX-YYYYY`

#### SRT

Setup your [encoder and create a Bintu stream](https://docs.nanocosmos.de/docs/cloud/srt_ingest).

Example SRT ingest URL - you need to replace the stream name `XXXXX-YYYYY`:

`srt://bintu-srt.nanocosmos.de:5000?mode=caller&latency=500000&timeout=1000000&transtype=live&streamid=push:XXXXX-YYYYY`

#### WebRTC

Open the WebRTC client UI:

- either use URL `https://webrtc.pages.nanocosmos.de/webrtc-client-main/release/webcast.html?bintu.apikey=yourAPIkeyhere`
  - **API key has to be replaced in the URL**
  - below "Broadcast Settings" uncheck "Use bintu.live to create streams"
  - set "RTMP Broadcast Url" to `rtmp://XXXXX-YYYYY.bintu-vtrans.nanocosmos.de/live`
- or use URL params to set the RTMP URL and RTMP stream name directly: `https://webrtc.pages.nanocosmos.de/webrtc-client-main/release/webcast.html?bintu.apikey=yourAPIkeyhere&stream.url=rtmp://XXXXX-YYYYY.bintu-vtrans.nanocosmos.de/live&stream.name=XXXXX-YYYYY`
  - **API key and stream name (XXXXX-YYYYY) have to be replaced in the URL**

### 3. Clipping and Sharing

Replay, Clipping and Sharing is using a separate player, the feature is not part of the live player (nanoPlayer / HLive).

When the live stream is running, you can use a separate player to

- rewind to any time in the past of the live stream
- trim a clip of the live stream
- share the clip with a dedicated URL

All recording and clipping is hosted in a cloud storage at nanocosmos, accessible via https from any browser.
The clips are currently based on the HLS stream format.
The replay demo apps are using the open source hls.js player to access the clips.

### Apps and Components

Direct links to open your stream and session in replay demo apps can be found in the cloud dashboard.
https://docs.nanocosmos.de/docs/cloud-frontend-v3/Dashboard_Live_Processing#output-links-and-assets 

#### Live Replay Library

A library to integrate in your workflow that provides the relevant URLs you need for this service.
[Check Out the Documentation](api.md)

Package path: live-replay/lib/lib.livereplay.js
Web URL: https://replay.nanocosmos.de/live-replay/lib/lib.livereplay.js

#### Live and Clipping Demo App

Web application showing replay, clipping, share link creation and real-time live playback side by side.

Package path: live-replay/demo/index.html
Web URL: https://replay.nanocosmos.de/live-replay/demo/index.html?streamname=XXXXX-YYYYY

Replace XXXXX-YYYYY with your stream name or enter it in the top right field.

On the left side you will see the playback of the replay stream.
On the right side you will see the real-time playback of the stream with H5Live.

- Use the slider on the video area on the left side to jump back to a past time of the stream, or use the button directly below (e.g. go back 30 seconds)
- Use the buttons "Set Start Point" and "Set End Point" to set the timestamps for start and end of the stream sequence you would like to share.
- The share URL is displayed below the buttons.
- Use the "Share" button for playback and/or sharing in a new browser tab

Additionally info: if you would like to process/download/convert the clip, an ffmpeg command is shown to generate a mp4 file of the specified stream sequence.

#### Clipping Demo App

Web application showing replay, clipping and share link creation.

Package path: live-replay/demo/clipping/index.html
Web URL: https://replay.nanocosmos.de/live-replay/demo/clipping/index.html?streamname=XXXXX-YYYYY

Replace XXXXX-YYYYY with your stream name or enter it in the top right field.

- Use the slider on the video area on the left side to jump back to a past time of the stream, or use the button directly below (e.g. go back 30 seconds)
- Use the buttons "Set Start Point" and "Set End Point" to set the timestamps for start and end of the stream sequence you would like to share.
- The share URL is displayed below the buttons.
- Use the "Share" button for playback and/or sharing in a new browser tab

Additionally info: if you would like to process/download/convert the clip, an ffmpeg command is shown to generate a mp4 file of the specified stream sequence.

#### Replayer App

Lean player app for playback of replay share links.

Package path: live-replay/replayer/index.html
Web URL: https://replay.nanocosmos.de/live-replay/replayer/index.html?share=YOUR_SHARE

Replace YOUR_SHARE with your share string.

#### Dependencies

- The demo and replayer apps are using the open source hls.js video player

## Recorded HLS stream

The recorded HLS stream is also directly available for playback at the URL
`https://bintu-vod.nanocosmos.de/vod/replay/XXXXX-YYYYY.m3u8`

Replace XXXXX-YYYYY with your stream name.
