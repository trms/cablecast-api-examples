import { cablecastAPIRequest, loadNewShowConfig } from './utils.mjs';

/**
 * These values are all hard coded but could come from command line arguments,
 * database records, form inputs, or other sources as needed.
 */
const scriptParams = {
    formatName: 'City Meeting',
    newShowName: `City Council Meeting - ${new Date().toLocaleString()}`,
    showLengthInSeconds: 60 * 60 * 2, // 2 hours
    channelName: 'ENG Demo',
    recordDeviceName: 'Eng Demo - VIO Encode 1'
};



// Main function to execute the script
async function main() {
    const config = await loadNewShowConfig(scriptParams);

    // Create a new show
    let newShow = {
        show: {
            title: scriptParams.newShowName,
            cgTitle: scriptParams.newShowName,
            cgExempt: false,
            comments: 'Created by an API script',
            location: config.locationId,
            customFields: [], // Placeholder for any custom fields
        }
    };
    let showResponse = await cablecastAPIRequest(`/cablecastapi/v1/shows`, 'POST', newShow);

    // Create new media for the show
    let newMedia = {
        media: {
            creationDate: new Date().toISOString(),
            location: config.locationId,
            format: config.formatId,
            mediaName: `Media for ShowID: ${showResponse.show.id} - ${scriptParams.newShowName}`,
        }
    };
    let mediaResponse = await cablecastAPIRequest(`/cablecastapi/v1/media`, 'POST', newMedia);

    // Create a new reel linking the media and the show
    let newReel = {
        reel: {
            media: mediaResponse.media.id,
            show: showResponse.show.id,
            reelNumber: 1,
            cue: 0,
            length: scriptParams.showLengthInSeconds
        }
    };
    await cablecastAPIRequest(`/cablecastapi/v1/reels`, 'POST', newReel);

    console.log(`New ShowID: ${showResponse.show.id}`);

    // Create a VOD entry for the show
    var newVod = {
        vod: {
            show: showResponse.show.id,
            vodConfiguration: config.vodConfigurationId,
        }
    };
    let vodResponse = await cablecastAPIRequest(`/cablecastapi/v1/vods`, 'POST', newVod);
    console.log(`VOD ID: ${vodResponse.vod.id}`);

    // Schedule the show on the selected channel
    let runDateTime = new Date();
    runDateTime.setHours(runDateTime.getHours() + 2); // Schedule 2 hours from now
    let newScheduleItem = {
        scheduleItem: {
            idType: 1, // Indicates this is a show (1 = Show, 2 = Media)
            filler: false,
            deleted: false,
            show: showResponse.show.id,
            channel: config.channelId,
            runDateTime: runDateTime.toISOString(),
        }
    };
    let scheduleResponse = await cablecastAPIRequest(`/cablecastapi/v1/scheduleitems`, 'POST', newScheduleItem);
    console.log('Schedule Item ID: ', scheduleResponse.scheduleItem.id);

    // Create a record event for the show
    let newRecordEvent = {
        recordEvent: {
            location: config.locationId,
            name: `Recording for ShowID: ${showResponse.show.id} - ${scriptParams.newShowName}`,
            runDateTime: runDateTime.toISOString(),
            length: scriptParams.showLengthInSeconds,
            scheduleItem: scheduleResponse.scheduleItem.id,
            deviceFileKey: `${showResponse.show.id}-${mediaResponse.media.id}-1 - ${scriptParams.newShowName}`,
            recordDevice: config.recordDeviceId,
        }
    };
    let recordEventResponse = await cablecastAPIRequest(`/cablecastapi/v1/recordevents`, 'POST', newRecordEvent);
    console.log(`Record Event ID: ${recordEventResponse.recordEvent.id}`);

    // Set up autopilot to commit the schedule
    let start = new Date();
    let end = new Date();
    end.setDate(end.getDate() + 7); // Autopilot sends for the next 7 days
    let newAutopilotSend = {
        autopilotSend: {
            location: config.locationId,
            sendToHardware: true,
            stickyDevices: false,
            start: start.toISOString(),
            end: end.toISOString(),
            sentBy: 'API Script',
        }
    };
    let autopilotSendResponse = await cablecastAPIRequest(`/cablecastapi/v1/autopilotsends`, 'POST', newAutopilotSend);
    console.log(`Autopilot Send ID: ${autopilotSendResponse.autopilotSend.id}`);
}

// Execute the main function
main().catch(error => console.error(error));
