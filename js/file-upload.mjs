import 'dotenv/config';
import { cablecastAPIRequest, SERVER_BASE_URL, USERNAME, PASSWORD } from './utils.mjs';
import { openSync, readSync, closeSync, statSync } from 'fs';
import { basename } from 'path';

/**
 * Uploads a file to Cablecast using the chunked FileUpload API.
 *
 * The upload workflow is:
 *   1. POST /v1/fileuploads           - Create an upload job
 *   2. POST /v1/fileuploads/{id}/upload - Upload each chunk (segment)
 *   3. PUT  /v1/fileuploads/{id}       - Mark upload complete (triggers asset creation)
 *   4. Poll GET /v1/fileuploads/{id}   - Wait for server to finish processing
 *
 * FileUpload States:
 *   0 = Error
 *   1 = Uploading          (segments being received)
 *   2 = UploadingComplete   (client done, server reassembling)
 *   3 = PostProcessing      (reassembling segments)
 *   4 = Transferring        (moving file to destination store)
 *   5 = Finished            (complete)
 *   6 = Timeout             (abandoned after 4 hours of inactivity)
 *
 * Usage:
 *   node file-upload.mjs <path-to-file> [destination-store-id]
 *
 * Example:
 *   node file-upload.mjs ./my-video.mp4 11
 */

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per segment

async function main() {
    const filePath = process.argv[2];
    const destinationStoreId = parseInt(process.argv[3] || '11', 10);

    if (!filePath) {
        console.error('Usage: node file-upload.mjs <path-to-file> [destination-store-id]');
        console.error('');
        console.error('  destination-store-id defaults to 11. Use GET /v1/filestores to list available stores.');
        process.exit(1);
    }

    if (Number.isNaN(destinationStoreId)) {
        console.error('destination-store-id must be a number');
        process.exit(1);
    }

    const fileName = basename(filePath);
    const fileSize = statSync(filePath).size;
    const totalSegments = Math.ceil(fileSize / CHUNK_SIZE);

    console.log(`File: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`Destination store: ${destinationStoreId}`);
    console.log(`Segments: ${totalSegments} (${(CHUNK_SIZE / 1024 / 1024).toFixed(0)} MB each)`);
    console.log('');

    // Step 1: Create the FileUpload record
    console.log('Creating upload job...');
    const createResponse = await cablecastAPIRequest('/cablecastapi/v1/fileuploads', 'POST', {
        fileUpload: {
            fileName: fileName,
            destinationStore: destinationStoreId,
            totalSegments: totalSegments,
            size: fileSize,
        }
    });
    const uploadId = createResponse.fileUpload.id;
    console.log(`Upload job created: ID ${uploadId}`);

    // Step 2: Upload each segment
    // The segment upload endpoint expects multipart form data with a "file" field
    // and a "segment" field. We can't use cablecastAPIRequest here since it sends JSON.
    // Read each chunk from disk on demand so memory usage stays bounded to ~CHUNK_SIZE.
    const fd = openSync(filePath, 'r');
    try {
        for (let segment = 0; segment < totalSegments; segment++) {
            const start = segment * CHUNK_SIZE;
            const chunkSize = Math.min(CHUNK_SIZE, fileSize - start);
            const chunk = Buffer.alloc(chunkSize);
            readSync(fd, chunk, 0, chunkSize, start);

            const formData = new FormData();
            formData.append('segment', segment.toString());
            formData.append('file', new Blob([chunk]), fileName);

            const response = await fetch(
                `${SERVER_BASE_URL}/cablecastapi/v1/fileuploads/${uploadId}/upload`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`,
                    },
                    body: formData,
                }
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to upload segment ${segment}: ${response.status} ${text}`);
            }

            console.log(`  Uploaded segment ${segment + 1} of ${totalSegments} (${(chunkSize / 1024).toFixed(0)} KB)`);
        }
    } finally {
        closeSync(fd);
    }

    // Step 3: Mark the upload as complete (state 2 = UploadingComplete)
    // This triggers the server to create an Asset and link it to the destination file store.
    console.log('Marking upload complete...');
    const completeResponse = await cablecastAPIRequest(`/cablecastapi/v1/fileuploads/${uploadId}`, 'PUT', {
        fileUpload: {
            state: 2, // UploadingComplete
        }
    });
    console.log(`Upload marked complete. Asset ID: ${completeResponse.fileUpload.asset ?? '(pending)'}`);

    // Step 4: Poll until the server finishes processing
    console.log('Waiting for server to process file...');
    const maxWaitMs = 5 * 60 * 1000; // 5 minutes
    const pollIntervalMs = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        const status = await cablecastAPIRequest(`/cablecastapi/v1/fileuploads/${uploadId}`);
        const state = status.fileUpload.state;

        const stateNames = {
            0: 'Error', 1: 'Uploading', 2: 'UploadingComplete',
            3: 'PostProcessing', 4: 'Transferring', 5: 'Finished', 6: 'Timeout'
        };
        console.log(`  State: ${stateNames[state] || state} (${state})`);

        if (state === 5) {
            console.log('');
            console.log('Upload complete!');
            console.log(`  FileUpload ID: ${status.fileUpload.id}`);
            console.log(`  Asset ID: ${status.fileUpload.asset}`);
            console.log(`  File: ${status.fileUpload.fileName}`);
            return;
        }

        if (state === 0 || state === 6) {
            throw new Error(`Upload failed with state: ${stateNames[state]} (${state})`);
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    console.error('Timed out waiting for processing. Check the upload status manually:');
    console.error(`  GET /cablecastapi/v1/fileuploads/${uploadId}`);
    process.exit(1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
