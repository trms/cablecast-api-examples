const SERVER_BASE_URL = 'https://eng-demo.cablecast.tv';
const USERNAME = 'admin';
const PASSWORD = process.env.CABLECAST_PASSWORD ?? 'yourpassword';

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

    let vodConfigurations = await cablecastAPIRequest('/cablecastapi/v1/vodconfigurations');
    if (vodConfigurations.vodConfigurations.length === 0) {
        throw new Error('No VOD Configurations found');
    }
    let vodConfig = vodConfigurations.vodConfigurations.find(v => v.location === location.id);
    if (!vodConfig) {
        throw new Error('No VOD Configuration found for location');
    }

    let channels = await cablecastAPIRequest(`/cablecastapi/v1/channels`);
    let channel = channels.channels.find(c => c.name === params.channelName);
    if (!channel) {
        throw new Error(`Channel not found: ${params.channelName}`);
    }

    let devicesResponse = await cablecastAPIRequest(`/cablecastapi/v1/devices`);
    let recordDevice = devicesResponse.devices.find(d => d.name === params.recordDeviceName);

    let showFields = await cablecastAPIRequest(`/cablecastapi/v1/showfields`);

    let customFields = showFields.showFields.map(f => {
        let fieldDefinition = showFields.fieldDefinitions.find(fd => fd.id == f.fieldDefinition);
        return {
            id: f.id,
            name: fieldDefinition.name,
        }
    });

    return {
        customFields,
        locationId: location.id,
        formatId: format.id,
        vodConfigurationId: vodConfig.id,
        channelId: channel.id,
        recordDeviceId: recordDevice.id
    };
}