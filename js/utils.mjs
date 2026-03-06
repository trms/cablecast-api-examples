
export const SERVER_BASE_URL = 'https://eng-demo.cablecast.tv';
export const USERNAME = 'admin';
export const PASSWORD = process.env.CABLECAST_PASSWORD ?? 'yourpassword';

export async function cablecastAPIRequest(endpoint, method = 'GET', body, parseResponse = true) {
    let response = await fetch(`${SERVER_BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Authorization': `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        console.log(`Error during API request to ${endpoint}:`);
        console.log(await response.text());
        throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);

    }

    if (parseResponse)
        return await response.json();
    else 
        return undefined
}

// Function to load all necessary configurations
export async function loadNewShowConfig(params) {
    let locations = await cablecastAPIRequest(`/cablecastapi/v1/locations`);
    if (locations.locations.length === 0) {
        throw new Error('No locations found');
    }
    let location = locations.locations[0];

    let formats = await cablecastAPIRequest(`/cablecastapi/v1/formats`);
    if (formats.formats.length === 0) {
        throw new Error('No formats found');
    }
    let format = formats.formats.find(f => f.name === params.formatName && f.location == location.id);
    if (!format) {
        console.log('Requested format not found, using first available format');
        format = formats.formats[0];
    }

    let vodConfigurations = await cablecastAPIRequest('/cablecastapi/v1/vodconfigurations');
    if (vodConfigurations.vodConfigurations.length === 0) {
        throw new Error('No VOD Configurations found');
    }
    let vodConfig = vodConfigurations.vodConfigurations.find(v => v.location === location.id);
    if (!vodConfig) {
        throw new Error('No VOD Configuration found for location');
    }

    let channels = await cablecastAPIRequest(`/cablecastapi/v1/channels`);
    if (channels.channels.length === 0) {
        throw new Error('No channels found');
    }
    let channel = channels.channels.find(c => c.name === params.channelName);
    if (!channel) {
        console.log(`Channel not found: ${params.channelName}, using first available channel`);
        channel = channels.channels[0];
    }

    let devicesResponse = await cablecastAPIRequest(`/cablecastapi/v1/devices`);
    let recordDevice = devicesResponse.devices.find(d => d.name === params.recordDeviceName);
    if (!recordDevice) {
        console.log(`Requested Record device not found: ${params.recordDeviceName}`);
        recordDevice = devicesResponse.devices.find(d => d.primitiveDevice == 5); // 5 is Record Device
    }

    if (!recordDevice) {
        console.log("No record device found.");
    }

    return {
        locationId: location.id,
        formatId: format.id,
        vodConfigurationId: vodConfig ? vodConfig.id : undefined,
        channelId: channel ? channel.id : undefined,
        recordDeviceId: recordDevice ? recordDevice.id : undefined
    };
}