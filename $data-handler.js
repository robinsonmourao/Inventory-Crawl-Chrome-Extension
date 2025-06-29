window.$dataHandler = async function(allVehicleCards, csvData, result, testType, highlightCard) {
    let csvMap = {};
    if (csvData) {
        csvMap = await csvParser(csvData);
    }

    switch(testType) {
        case "CSV_SRP_DATA_MATCHER":
            let processedVehicles = 0;
            let vehiclesWithMismatches = 0;

            if (!result || Array.isArray(result)) {
                result = {};
            }
            
            const csvHeaders = Object.keys(csvMap[Object.keys(csvMap)[0]] || {});
            
            const fieldToCsvMapping = {};
            Object.keys(window.customFieldMap).forEach(fieldKey => {
                if (csvHeaders.includes(fieldKey)) {
                    fieldToCsvMapping[fieldKey] = fieldKey;
                } else {
                    const matchingHeader = csvHeaders.find(header => 
                        header.toLowerCase() === fieldKey.toLowerCase()
                    );
                    if (matchingHeader) {
                        fieldToCsvMapping[fieldKey] = matchingHeader;
                    } else {
                        console.warn(`No matching CSV header found for field: ${fieldKey}`);
                    }
                }
            });
            
            for (const srpVehicle of allVehicleCards) {
                const stockSelector = window.customFieldMap.STOCKNUMBER;
                const srpStockNumber = await getTextFromVehicleCard(srpVehicle, stockSelector);
                const csvVehicle = csvMap[srpStockNumber];

                if (srpStockNumber && csvVehicle && typeof csvVehicle === 'object') {
                    processedVehicles++;
                    let hasMismatches = false;
                    let mismatches = {};
                    //console.log("____________________________________________________________________________________");

                    for (const [field, selector] of Object.entries(window.customFieldMap)) {
                        if (!selector) continue;

                        const srpRaw = await getTextFromVehicleCard(srpVehicle, selector);
                        const csvHeader = fieldToCsvMapping[field];
                        const csvRaw = csvHeader ? csvVehicle[csvHeader] : undefined;                        
                        
                        const csvNormalizedValue = normalizeValue(field, csvRaw);
                        const srpNormalizedValue = normalizeValue(field, srpRaw);
                        //console.log(`${field}, Selector: ${selector}, CSV Header: ${csvHeader}, CSV Normalized: ${csvNormalizedValue}, SRP Normalized: ${srpNormalizedValue}`);

                        if (await isExceptionValue(field, csvNormalizedValue, srpNormalizedValue)) {
                            continue;
                        }

                        let matched = srpNormalizedValue === csvNormalizedValue;
                        
                        if (!matched) {
                            hasMismatches = true;
                            mismatches[field] = {
                                csv: csvNormalizedValue,
                                srp: srpNormalizedValue
                            };
                        }
                    }

                    if (hasMismatches) {
                        vehiclesWithMismatches++;
                        result[srpStockNumber] = { mismatches };
                    }
                }
            }
            return result;

        case "COMING_SOON_DETECTOR":
            if (!highlightCard) {
                console.error('highlightCard function is required for COMING_SOON_DETECTOR');
                return allVehicleCards.length;
            }

            const PAGINATION_SCROLL_TYPE = isPaginationScrollType();
            const VIEW_MORE_VEHICLES_SCROLL_TYPE = isViewMoreScrollType();
            const elements = document.querySelectorAll('div.vehicle-car__section.vehicle-car-1');

            for (const element of elements) {
                if (element.classList.contains('processed-card')) continue;

                const modelElement = element.querySelector('.value__model');
                const trimElement = element.querySelector('.value__trim');
                const stockNumberElement = element.querySelector('.stock_label') || element.querySelector('.stock_number') || element.querySelector('.value__stock');
                const imageUrlElement = element.querySelector('.main-img');
                const sourceElement = element.querySelector('source');

                try {
                    if (modelElement && stockNumberElement && (imageUrlElement || sourceElement)) {
                        const model = modelElement.textContent.trim();
                        const trim = trimElement ? trimElement.textContent.trim() : '';
                        
                        let stockNumber = '';
                        if (stockNumberElement.classList.contains('stock_label')) {
                            const stockNumberText = stockNumberElement.textContent.trim();
                            stockNumber = stockNumberText.split('Stock#:')[1]?.trim() || '';
                        } else {
                            stockNumber = stockNumberElement.textContent.trim();
                        }

                        let imageUrl = '';
                        if (imageUrlElement?.dataset.src) {
                            imageUrl = imageUrlElement.dataset.src;
                        } else if (sourceElement?.srcset) {
                            imageUrl = sourceElement.srcset;
                        } else if (imageUrlElement?.src) {
                            imageUrl = imageUrlElement.src;
                        }

                        if (imageUrl && stockNumber) {
                            element.classList.remove('waiting-card');
                            
                            if (PAGINATION_SCROLL_TYPE) {
                                const isComingSoon = await highlightCard(element, async () => {
                                    return await window.isComingSoonImageByOCR(imageUrl);
                                });
                                
                                if (isComingSoon) {
                                    const alreadyExists = result.some(item => item.stockNumber === stockNumber);
                                    if (!alreadyExists) {
                                        result.push({ model, trim, stockNumber, imageUrl });
                                    }
                                }
                            } 
                            else if (VIEW_MORE_VEHICLES_SCROLL_TYPE) {
                                await highlightCard(element, async () => {
                                    if (isBetterPhotoImage(imageUrl)) {
                                        const alreadyExists = result.some(item => item.stockNumber === stockNumber);
                                        if (!alreadyExists) {
                                            result.push({ model, trim, stockNumber, imageUrl });
                                            return true;
                                        }
                                    }
                                    return false;
                                });
                            } else {
                                await highlightCard(element, async () => {
                                    if (isBetterPhotoImage(imageUrl)) {
                                        const alreadyExists = result.some(item => item.stockNumber === stockNumber);
                                        if (!alreadyExists) {
                                            result.push({ model, trim, stockNumber, imageUrl });
                                            return true;
                                        }
                                    }
                                    return false;
                                });
                            }
                        } else {
                            console.log('Missing required data:', {
                                hasImageUrl: !!imageUrl,
                                hasStockNumber: !!stockNumber
                            });
                            element.classList.remove('waiting-card');
                            element.classList.add('processed-card');
                            element.setAttribute('data-processing-info', 'Missing data');
                        }
                    } else {
                        console.log('Missing required elements:', {
                            hasModel: !!modelElement,
                            hasStockNumber: !!stockNumberElement,
                            hasImage: !!(imageUrlElement || sourceElement)
                        });
                        element.classList.remove('waiting-card');
                        element.classList.add('processed-card');
                        element.setAttribute('data-processing-info', 'Missing elements');
                    }
                } catch (error) {
                    console.error("An error occurred while processing elements:", error);
                    element.classList.remove('waiting-card');
                    element.classList.add('processed-card');
                    element.setAttribute('data-processing-info', 'Error processing');
                }
            }
            break;
    }
    return allVehicleCards.length;
}

function isBetterPhotoImage(imageUrl) {
    return imageUrl.includes('better-photo.jpg');
}

async function isExceptionValue(csv_key, csv_value, srp_value) {
    if (!srp_value && !csv_value) return true;

    let anyValue = "*.*";

    let mismatcheExceptions = [
        { csv: [anyValue], srp: [""] },
        { csv: ["0"], srp: ["–"] },
        { csv: [""], srp: ["contactus"] }
    ];

    switch (csv_key) {
        case 'STOCKNUMBER':
            return true;
        case 'KILOMETERS':
            var hasSRPReturnerVin = srp_value.length === 17;
            if (hasSRPReturnerVin){
                return true;
            } break;
        case 'VIN':
            var hasSRPReturnerVin = srp_value.length === 17;
            if (!hasSRPReturnerVin){
                return true;
            } break;
    }

    for (const exception of mismatcheExceptions) {
        if (exception.srp.includes(srp_value) &&
            (exception.csv.includes(csv_value) || exception.csv.includes(anyValue))) {
            return true;
        }
    }
    return false;
}

function normalizeValue(key, value) {
    if (!value) return '';

    let normalized = value.toString();

    switch (key){
        case 'CONDITION':
            return normalized.toLowerCase();
        case 'PRICE':
            normalized = normalized.toLowerCase();
            return normalized.replace(/[$,]/g, '');
        case 'KILOMETERS':
            return normalized.replace(/[km\s,]|\.00000/g, '');
        default:
            if (normalized.includes("-card.jpg")){
                return normalized.replace("-card.jpg", "");
            }
            else if (normalized.includes("-THIRDPARTY.jpg")){
                return normalized.replace("-THIRDPARTY.jpg", "");
            }
            else{
                return normalized.trim();
            }
    }
}

async function getTextFromVehicleCard(vehicleCard, selector) {
    try {
        if (!vehicleCard) return "";
        const vehicleCardElement = vehicleCard.querySelector(selector);
        if (!vehicleCardElement) return "";
        
        switch (vehicleCardElement.tagName) {
            case "IMG":
                return handleImageElement(vehicleCardElement);
            default:
                return handleTextElement(vehicleCardElement);
        }
    } catch (error) {
        console.error("An error occurred while getting the text:", error);
        return "";
    }
}

function handleImageElement(imgElement) {
    const isSpinner = imgElement.src.includes("spinner.gif");
    const imgSrcCardByThirdpartyReplacement = isSpinner ? imgElement.getAttribute("data-src") || "" : imgElement.src || "";
    return imgSrcCardByThirdpartyReplacement || "";    
}


function handleTextElement(element) {
    let textSurroundingSpacesTrimmed = element.textContent.trim();
    return textSurroundingSpacesTrimmed.includes("Stock#:") ? textSurroundingSpacesTrimmed.replace("Stock#:", "").trim() : textSurroundingSpacesTrimmed;
}

async function csvParser(csvVehicle) {
    const lines = csvVehicle.trim().split('\n');
  
    const headers = lines[0].split('|');
    const stockDataMap = {};
    let values, entry = {};
    let skippedLines = 0;
  
    for (let i = 1; i < lines.length; i++) {
        values = lines[i].split('|');
        entry = {};
  
        headers.forEach((key, index) => {
            entry[key.trim()] = values[index]?.trim() ?? '';
        });
  
        const stockNumber = entry['StockNumber'];
        if (stockNumber) {
            stockDataMap[stockNumber] = entry;
        } else {
            skippedLines++;
        }
    }
    return stockDataMap;
}

window.extractCSVHeaders = function(csvData) {
    
    if (!csvData || typeof csvData !== 'string') {
        console.warn("Invalid CSV data");
        return [];
    }

    const lines = csvData.split('\n');
    
    if (lines.length === 0) {
        console.warn("No lines found in CSV");
        return [];
    }

    const firstLine = lines[0];

    const delimiters = [',', '|', '\t'];
    let bestHeaders = [];
    let maxFields = 0;

    for (const delimiter of delimiters) {
        const headers = firstLine.split(delimiter).map(header => header.trim()).filter(Boolean);
        if (headers.length > maxFields) {
            maxFields = headers.length;
            bestHeaders = headers;
        }
    }    
    return bestHeaders;
};

globalThis.extractCSVHeaders = window.extractCSVHeaders;