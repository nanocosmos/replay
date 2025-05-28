## [1.23.0]

### Clip And Share

#### Added

- support for ABR playback and multivariant playlists
  - no quality selector is displayed but the ABR information is used internally to generate the Share, FFMPEG and Embed Links

#### Fixed

- general fixes to make it functional from Bintu Console

### Replayer

#### Added

- support for ABR playback and multivariant playlists
- ABR quality selector control

#### Improved

- handling and reporting of HLS.js errors

### Library

#### Added

- support for ABR playback and multivariant playlists
- ABR playlist support for functions getFFMPEGCommandLine, getShareUrl, getEmbedUrl
- ABR related utility functions getResolvedHlsUrl, findBestHlsUrl, isNativeAbr

## [1.22.0]

#### Added

- Initial public release 
