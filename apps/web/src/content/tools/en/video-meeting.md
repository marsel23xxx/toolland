---
name: 'Video Meeting'
title: 'Free Video Meeting Without an App: 4-Person Video Calls in Your Browser'
description: 'Free video meetings and calls for 2-4 people right in your browser. No account, no install, with screen sharing, chat, background blur, and a waiting room.'
summary: '2-4 person video calls with no account or app.'
category: 'media'
idSlug: 'rapat-online'
keywords:
  [
    'video meeting',
    'video call',
    'free video conference',
    'online meeting',
    'zoom alternative',
    'screen sharing',
    'blur background',
  ]
howTo:
  - 'Click New meeting and allow your camera and microphone. Set your name and turn on background blur if you like.'
  - 'Copy the invite link and send it to participants. When they open it, you as host admit them from the waiting room.'
  - 'Meet with camera, mic, screen sharing, and chat. Click Leave when done; nothing is recorded or stored.'
faq:
  - q: 'How many people can join?'
    a: 'Up to 4 people per meeting. Video goes directly between participants (peer-to-peer), so each person sends their video to everyone else. With 4 people, a stable connection helps a lot.'
  - q: 'Is my meeting recorded or stored?'
    a: 'No. Video and audio flow directly between browsers, encrypted by WebRTC. The Toolland server only introduces participants and relays chat, storing nothing. Chat disappears when the meeting ends.'
  - q: 'Why can some people not connect?'
    a: 'Some office, campus, or mobile networks block direct device-to-device connections. Try another network, such as a phone hotspot. Support for strict networks will be added later.'
  - q: 'How do the waiting room and meeting lock work?'
    a: 'Whoever creates the meeting is the host. With the waiting room on, new people must be admitted by the host first. The host can also lock the meeting so no one else can join, and remove participants. If the host leaves, the next participant becomes host.'
  - q: 'Does background blur send my video to a server?'
    a: 'No. Blur is computed in your browser with a small MediaPipe model. Other participants only receive the already-blurred video.'
  - q: 'Does it work on phones?'
    a: 'Yes, in a recent Chrome or Safari. Screen sharing is only available on computers because mobile browsers do not support it yet.'
related: ['screen-recorder', 'video-editor', 'compress-video']
---

## Small meetings, no hassle

For group work, mentoring, or catching up with family, you do not need an account or an app.
Start a meeting, copy the link, send it, and begin.

## Private by design

- **Peer-to-peer**: video and audio go directly between participants, encrypted, not through the
  Toolland server.
- **The meeting code in the link** (after the #) is never sent to the server as part of the page
  address.
- **No recordings or history**: chat disappears when the meeting ends.

## Tips for a smooth call

1. **Use earphones** to avoid echo.
2. **Turn off your camera** if the connection is slow; audio keeps working.
3. **Keep the waiting room on** (the default) so only people you admit can join.
