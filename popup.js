const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        justify-content: center;
        align-items: center;
    }

    .loading-overlay.visible {
        display: flex;
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.className = 'loading-overlay';
const spinner = document.createElement('div');
spinner.className = 'loading-spinner';
overlay.appendChild(spinner);
document.body.appendChild(overlay);

function toggleLoading(show) {
    if (show) {
        overlay.classList.add('visible');
    } else {
        overlay.classList.remove('visible');
    }
}

async function sendMessageToBackground(message) {
    try {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return null;
    }
}

chrome.runtime.sendMessage({ type: 'checkProcessingState' }, (response) => {
    if (response && response.isProcessing) {
        toggleLoading(true);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'startProcessing') {
        console.log('Starting processing...');
        toggleLoading(true);
        sendResponse({ success: true });
    } else if (message.type === 'stopProcessing') {
        console.log('Stopping processing...');
        setTimeout(() => {
            toggleLoading(false);
        }, 500);
        sendResponse({ success: true });
    } else if (message.type === 'exportToCSV') {
        console.log('Received export message:', {
            testType: message.testType,
            dataType: typeof message.data,
            isArray: Array.isArray(message.data),
            keys: Object.keys(message.data || {}),
            sample: message.data ? Object.values(message.data)[0] : null
        });
        exportToCSVFile(message.data, message.testType, message.siteName);
        sendResponse({ success: true });
    }
    return true;
});

window.addEventListener('unload', async () => {
    try {
        await sendMessageToBackground({ type: 'stopProcessing' });
    } catch (error) {
        console.error('Error stopping processing on unload:', error);
    }
});

window.addEventListener('blur', async () => {
    try {
        await sendMessageToBackground({ type: 'stopProcessing' });
    } catch (error) {
        console.error('Error stopping processing on blur:', error);
    }
});

const docsButton = document.querySelector('.docs-button');
const docsPopup = document.querySelector('.docs-popup');
let docsHideTimeout;

docsButton.addEventListener('mouseenter', function() {
    clearTimeout(docsHideTimeout);
    docsPopup.style.display = 'block';
    setTimeout(() => docsPopup.classList.add('visible'), 10);
});

docsButton.addEventListener('mouseleave', function() {
    docsHideTimeout = setTimeout(() => {
        docsPopup.classList.remove('visible');
        setTimeout(() => {
            if (!docsPopup.matches(':hover')) {
                docsPopup.style.display = 'none';
            }
        }, 200);
    }, 100);
});

docsPopup.addEventListener('mouseenter', function() {
    clearTimeout(docsHideTimeout);
    docsPopup.classList.add('visible');
});

docsPopup.addEventListener('mouseleave', function() {
    docsHideTimeout = setTimeout(() => {
        docsPopup.classList.remove('visible');
        setTimeout(() => {
            if (!docsButton.matches(':hover')) {
                docsPopup.style.display = 'none';
            }
        }, 200);
    }, 100);
});

const featuresButton = document.querySelector('.features-button');
const featuresList = document.querySelector('.features-list');
let featuresHideTimeout;

featuresButton.addEventListener('mouseenter', function() {
    clearTimeout(featuresHideTimeout);
    featuresList.style.display = 'block';
    setTimeout(() => featuresList.classList.add('visible'), 10);
});

featuresButton.addEventListener('mouseleave', function() {
    featuresHideTimeout = setTimeout(() => {
        featuresList.classList.remove('visible');
        setTimeout(() => {
            if (!featuresList.matches(':hover')) {
                featuresList.style.display = 'none';
            }
        }, 200);
    }, 100);
});

featuresList.addEventListener('mouseenter', function() {
    clearTimeout(featuresHideTimeout);
    featuresList.classList.add('visible');
});

featuresList.addEventListener('mouseleave', function() {
    featuresHideTimeout = setTimeout(() => {
        featuresList.classList.remove('visible');
        setTimeout(() => {
            if (!featuresButton.matches(':hover')) {
                featuresList.style.display = 'none';
            }
        }, 200);
    }, 100);
});

import { exportFieldMapsToJson, importFieldMapsFromJson } from './field-map-storage.js';
import { exportToCSVFile } from './$csv-exporter.js';

document.getElementById('exportButton').addEventListener('click', async () => {
    try {
        toggleLoading(true);
        await exportFieldMapsToJson();
    } catch (error) {
        console.error('Error exporting field maps:', error);
        alert('Error exporting field maps. Please try again.');
    } finally {
        toggleLoading(false);
    }
});

document.getElementById('importFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        toggleLoading(true);
        const success = await importFieldMapsFromJson(file);
        if (success) {
            alert('Field maps imported successfully!');
            window.location.reload();
        } else {
            alert('Error importing field maps. Please check the file format and try again.');
        }
    } catch (error) {
        console.error('Error importing field maps:', error);
        alert('Error importing field maps. Please try again.');
    } finally {
        toggleLoading(false);
        event.target.value = '';
    }
}); 