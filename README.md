# cablecast-api-examples


## JavaScript

### js/new-show.mjs

Creates a new show.
- Show has associated `media`, `reel` pointed at a `Live` format.
- VOD is created for the show so it is transcoded after a digital file is associated.
- Show is scheduled on a channel in 2 hours.
- A `RecordEvent` is set up for the schedule so the live show is recorded.
- An `AutopilotSend` is created to commit the schedule.

Before using this script edit the `utils.mjs` to point the script at your server and update the username and password.

Usage: `node new-show.mjs`

### js/macros.mjs

Lists all of the Control Rooms and Macros for a system. Also fires a named `Start Meeting` macro.

Usage: `node macros.mjs`

