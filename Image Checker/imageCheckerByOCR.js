import { OCR_API_KEY } from '../config.js';

let comingSoonImageSizes = new Set();

function loadFromStorage() {
    if (chrome?.storage?.local) {
        chrome.storage.local.get(['comingSoonImageSizes'], (result) => {
            if (result?.comingSoonImageSizes) {
                result.comingSoonImageSizes.forEach(size => comingSoonImageSizes.add(size));
                console.log('Loaded cached image sizes:', comingSoonImageSizes.size);
            }
        });
    }
}

async function saveToStorage() {
    if (chrome?.storage?.local) {
        try {
            await chrome.storage.local.set({ 
                comingSoonImageSizes: Array.from(comingSoonImageSizes) 
            });
        } catch (error) {
            console.warn('Failed to save to storage:', error);
        }
    }
}

loadFromStorage();

async function getImageFileSize(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const size = response.headers.get('Content-Length');
        return size ? parseInt(size, 10) : 0;
    } catch (err) {
        console.warn('Could not fetch image size:', url, err);
        return 0;
    }
}

export async function checkImageWithOCR(imageUrl) {
    try {
        const imageSize = await getImageFileSize(imageUrl);
        if (comingSoonImageSizes.has(imageSize)) {
            console.log('Found cached coming soon image size, skipping API call');
            return true;
        }

        const params = new URLSearchParams({
            apikey: OCR_API_KEY,
            url: imageUrl,
            language: 'eng'
        });
        const response = await fetch(`https://api.ocr.space/parse/imageurl?${params}`, {
            method: 'GET'
        });
        if (!response.ok) {
            throw new Error(`OCR API error: ${response.status} - ${response.statusText}`);
        }
        const result = await response.json();
        const text = result?.ParsedResults?.[0]?.ParsedText?.toLowerCase() || '';
        const isComingSoon = text.includes('coming soon');

        if (isComingSoon) {
            console.log('New coming soon image size found, adding to cache');
            comingSoonImageSizes.add(imageSize);
            await saveToStorage();
        }

        return isComingSoon;
    } catch (error) {
        console.error('OCR Error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}
  
