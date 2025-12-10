import 'dotenv/config';
import { cablecastAPIRequest, loadNewShowConfig } from './utils.mjs';

/**
 * These values are all hard coded but could come from command line arguments,
 * database records, form inputs, or other sources as needed.
 */
const scriptParams = {
    formatName: 'Video Server',
    channelName: 'ENG Demo',
};

async function fetchAssets() {
    const params = new URLSearchParams();
    params.append("offset", 0);
    params.append("sort", "last_modified");
    params.append("status_type[]", "Unlinked");
    params.append("purpose_type", "Playback");
    let assets = await cablecastAPIRequest(`/cablecastapi/v1/assets?${params.toString()}`);
    return assets;
}

function fileNameToTile(fileName) {
    let nameWithoutExtension = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
    let tile = nameWithoutExtension.replace(/[_-]+/g, ' '); // Replace underscores and hyphens with spaces
    tile = tile.replace(/\s+/g, ' ').trim(); // Collapse multiple spaces and trim
    tile = tile.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); // Capitalize each word
    return tile;
}



// Main function to execute the script
async function main() {
    let assets = await fetchAssets();
    const config = await loadNewShowConfig(scriptParams);

    // For example we'll just use the first asset if available
    if (assets.assets.length === 0) {
        console.log('No unlinked assets found.');
        return;
    }
    let selectedAsset = assets.assets[0];
    let assetInfo = assets.assetInfos.find(info => info.id === selectedAsset.assetInfos[0]);

    if (!assetInfo) {
        console.log('No asset info found for the selected asset.');
        return;
    }
    
    let lengthInSeconds = Math.ceil(assetInfo.frameCount / assetInfo.frameRate);
    console.log(`Creating show for ${selectedAsset.path} - duration ${lengthInSeconds} seconds`);

    // Create a new show
    let newShow = {
        show: {
            title: fileNameToTile(selectedAsset.path),
            cgTitle: fileNameToTile(selectedAsset.path),
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
    // Setting the `userFileName` to the asset path links the media to the asset without renaming the asset
    let newReel = {
        reels: [{
            media: mediaResponse.media.id,
            show: showResponse.show.id,
            reelNumber: 1,
            cue: 0,
            userFileName: selectedAsset.path,
            length: lengthInSeconds,
        }]
    };
    await cablecastAPIRequest(`/cablecastapi/v1/reels/batch`, 'POST', newReel);

    console.log(`New ShowID: ${showResponse.show.id}`);

    // See new-show.js if you need to create VODs, schedule items, record events, or autopilot sends
}

// Execute the main function
main().catch(error => console.error(error));
