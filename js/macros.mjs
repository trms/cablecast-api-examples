import 'dotenv/config';
import { cablecastAPIRequest } from './utils.mjs';

let controlRooms = await cablecastAPIRequest('/cablecastapi/v1/controlrooms');

controlRooms.controlRooms.forEach(cr => {
    console.log(`Control Room: ${cr.name}`);
    cr.macros.forEach(macro => {
        console.log(`  -- Macro ID: ${macro}`);
    });
});


let macros = await cablecastAPIRequest('/cablecastapi/v1/macros');
macros.macros.forEach(macro => {
    console.log(`Macro ID: ${macro.id}`);
    console.log(`  -- Name: ${macro.name}`);
});

// TODO replace with your macros above
const START_MEETING_MACRO_ID = 11;
const END_MEETING_MACRO_ID = 12;

console.log('Firing custom action');
await cablecastAPIRequest(`/cablecastapi/v1/forceevents/customaction/${START_MEETING_MACRO_ID}`, 'POST', {}, false);
