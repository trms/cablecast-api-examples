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

### js/file-upload.mjs

Uploads a file to Cablecast using the chunked FileUpload API. Demonstrates the full workflow:
1. Create an upload job (`POST /cablecastapi/v1/fileuploads`)
2. Upload the file in 5 MB segments (`POST /cablecastapi/v1/fileuploads/{id}/upload`)
3. Mark the upload complete (`PUT /cablecastapi/v1/fileuploads/{id}`) — this creates an Asset and links it to the destination file store
4. Poll until the server finishes processing the file

Usage: `node file-upload.mjs <path-to-file> [destination-store-id]`

The destination store ID defaults to `11`. Use `GET /cablecastapi/v1/filestores` to list available stores on your system.

### js/macros.mjs

Lists all of the Control Rooms and Macros for a system. Also fires a named `Start Meeting` macro.

Usage: `node macros.mjs`

