// content.js

let previousPokedexNumber = null;
let refreshIntervalId = null;

// UI Element References
let pluginContainer = null;
let imageElement = null;
let artistInfoDiv = null;
let controlsRow1 = null; // For Solo, Gender, Animated GIF
let degenModeButtonContainer = null; // Container FOR the Degen Mode button
let degenModeButton = null;    // The Degen Mode button itself
let degenControlsRow = null;   // For Scat, Diaper, Urine buttons
let nextImageButton = null;

// Filter States
let isSoloActive = true;
let activeGenderFilter = null;
let searchForAnimatedGif = false;
let isDegenModeOn = false;
let includeScat = false;
let includeDiaper = false;
let includeUrine = false;

// Button References for individual degen tags
let scatButton = null;
let diaperButton = null;
let urineButton = null;

function extractPokedexNumberFromPage() {
  const inputElement = document.querySelector('input[type="number"][data-form-type="other"].MuiInput-input');
  if (inputElement && typeof inputElement.value !== 'undefined') {
    const pokedexNumberString = inputElement.value;
    if (pokedexNumberString.trim() !== "") {
        const pokedexNumber = parseInt(pokedexNumberString, 10);
        if (!isNaN(pokedexNumber) && pokedexNumber > 0) return pokedexNumber;
    }
  }
  return null;
}

function handleApiResponse(response, requestedPokedexNumber) {
    if (previousPokedexNumber !== requestedPokedexNumber && requestedPokedexNumber !== undefined) {
      console.log("SoP: Pokedex number changed before API response for #", requestedPokedexNumber, "arrived. Ignoring.");
      return;
    }
    if (chrome.runtime.lastError) {
      console.error("SoP: Error receiving message:", chrome.runtime.lastError.message);
      removeAllUI(); return;
    }
    if (response && response.imageUrl) {
      displayImage(response.imageUrl, previousPokedexNumber, response.artistTags);
    } else if (response && response.error) {
      console.error("SoP: Error from background script:", response.error);
      alert("SoP e621: " + response.error);
      if (!response.imageUrl) removeAllUI(); // Clear everything if error implies no image
    } else {
      alert("SoP e621: No image found or unexpected response.");
      removeAllUI();
    }
}

function triggerBackgroundSearch(messageType, additionalPayload = {}) {
    if (!previousPokedexNumber && messageType !== "FETCH_IMAGE_BY_POKEDEX_NUMBER") {
        alert("Identify a Pokémon first."); return;
    }
    let message = { type: messageType, ...additionalPayload };
    if (messageType === "FETCH_IMAGE_BY_POKEDEX_NUMBER") {
        message.pokedexNumber = additionalPayload.pokedexNumber || previousPokedexNumber; // Use current or new
        message.soloState = isSoloActive;
        message.genderState = activeGenderFilter;
        message.animatedGifState = searchForAnimatedGif;
        message.degenModeState = isDegenModeOn;
        message.includeScatState = includeScat;
        message.includeDiaperState = includeDiaper;
        message.includeUrineState = includeUrine;
    }
    console.log("SoP: Sending message to background:", message);
    chrome.runtime.sendMessage(message, (response) => handleApiResponse(response, message.pokedexNumber || previousPokedexNumber));
}

function handleNextImageButtonClick() { triggerBackgroundSearch("FETCH_NEXT_E621_IMAGE"); }
function handleSoloToggleClick() {
    isSoloActive = !isSoloActive; updateButtonAppearances();
    triggerBackgroundSearch("SET_SOLO_FILTER_AND_REFRESH", { soloState: isSoloActive });
}
function handleGenderButtonClick(gender) {
    activeGenderFilter = (activeGenderFilter === gender) ? null : gender; updateButtonAppearances();
    triggerBackgroundSearch("SET_GENDER_FILTER_AND_REFRESH", { genderFilter: activeGenderFilter });
}
function handleAnimatedButtonClick() {
    searchForAnimatedGif = !searchForAnimatedGif; updateButtonAppearances();
    triggerBackgroundSearch("SET_ANIMATED_GIF_FILTER_AND_REFRESH", { animatedGifState: searchForAnimatedGif });
}
function handleDegenModeToggleClick() {
    isDegenModeOn = !isDegenModeOn;
    if (!isDegenModeOn) {
        includeScat = false; includeDiaper = false; includeUrine = false;
    }
    updateButtonAppearances();
    triggerBackgroundSearch("SET_DEGEN_MODE_AND_REFRESH", { 
        degenModeState: isDegenModeOn, 
        includeScat: includeScat, // Send reset states if degen mode turned off
        includeDiaper: includeDiaper, 
        includeUrine: includeUrine 
    });
}
function handleIndividualDegenTagClick(tagType) {
    if (!isDegenModeOn) return;
    let newState;
    if (tagType === 'scat') { includeScat = !includeScat; newState = includeScat; }
    else if (tagType === 'diaper') { includeDiaper = !includeDiaper; newState = includeDiaper; }
    else if (tagType === 'urine') { includeUrine = !includeUrine; newState = includeUrine; }
    updateButtonAppearances();
    triggerBackgroundSearch("SET_INDIVIDUAL_DEGEN_TAG_AND_REFRESH", { tagType: tagType, activeState: newState });
}

function updateButtonAppearances() {
    // Main filter buttons
    if (soloToggleButton) {
        soloToggleButton.textContent = `Solo: ${isSoloActive ? "On" : "Off"}`;
        soloToggleButton.className = `filter-button ${isSoloActive ? 'active-filter sop-solo-on' : 'inactive-filter sop-solo-off'}`;
    }
    if (maleButton) maleButton.className = `filter-button ${activeGenderFilter === 'male' ? 'active-filter sop-gender-active' : 'sop-gender-inactive'}`;
    if (femaleButton) femaleButton.className = `filter-button ${activeGenderFilter === 'female' ? 'active-filter sop-gender-active' : 'sop-gender-inactive'}`;
    if (animatedButton) {
        animatedButton.textContent = `GIFs: ${searchForAnimatedGif ? "On" : "Off"}`;
        animatedButton.className = `filter-button ${searchForAnimatedGif ? 'active-filter sop-animated-on' : 'inactive-filter sop-animated-off'}`;
    }
    
    // Degen Mode master button
    if (degenModeButton) {
        degenModeButton.textContent = `Degen Mode: ${isDegenModeOn ? "On" : "Off"}`;
        degenModeButton.className = `filter-button sop-degen-master-button ${isDegenModeOn ? 'active-filter sop-degen-on' : 'inactive-filter sop-degen-off'}`;
    }

    // Individual degen tag buttons container and buttons
    if (degenControlsRow) degenControlsRow.style.display = isDegenModeOn ? 'flex' : 'none';
    if (scatButton) {
        scatButton.textContent = `Scat: ${includeScat ? "On" : "Off"}`;
        scatButton.className = `filter-button sop-degen-tag-button ${includeScat ? 'active-filter sop-degen-tag-on' : 'inactive-filter sop-degen-tag-off'}`;
    }
    if (diaperButton) {
        diaperButton.textContent = `Diaper: ${includeDiaper ? "On" : "Off"}`;
        diaperButton.className = `filter-button sop-degen-tag-button ${includeDiaper ? 'active-filter sop-degen-tag-on' : 'inactive-filter sop-degen-tag-off'}`;
    }
    if (urineButton) {
        urineButton.textContent = `Urine: ${includeUrine ? "On" : "Off"}`;
        urineButton.className = `filter-button sop-degen-tag-button ${includeUrine ? 'active-filter sop-degen-tag-on' : 'inactive-filter sop-degen-tag-off'}`;
    }
}

function ensurePluginContainer() {
    if (!document.getElementById('sop-plugin-container')) {
        pluginContainer = document.createElement('div');
        pluginContainer.id = 'sop-plugin-container';
        document.body.appendChild(pluginContainer);
        console.log("SoP: Plugin container created.");
    } else {
        pluginContainer = document.getElementById('sop-plugin-container');
    }
}

function getOrCreateRow(id, parentContainer, insertBeforeElement = null) {
    let row = document.getElementById(id);
    if (!row || !row.isConnected) {
        if (row) row.remove(); // Remove if detached
        row = document.createElement('div');
        row.id = id;
        if (insertBeforeElement && insertBeforeElement.parentNode === parentContainer) {
            parentContainer.insertBefore(row, insertBeforeElement);
        } else {
            parentContainer.appendChild(row);
        }
        console.log("SoP: Row created/appended:", id);
    }
    row.innerHTML = ''; // Clear contents for fresh buttons
    return row;
}

function createButtonInRow(id, text, title, clickHandler, parentRow, baseClassName, specificClass = '') {
    // Button creation is now simpler as row.innerHTML='' clears old ones
    const button = document.createElement('button');
    button.id = id;
    button.classList.add(baseClassName);
    if(specificClass) button.classList.add(specificClass);
    if (text) button.textContent = text;
    button.title = title;
    button.addEventListener('click', clickHandler);
    parentRow.appendChild(button);
    return button;
}

function createOrShowControls() {
    ensurePluginContainer();

    // Order of rows: controlsRow1, degenModeButtonContainer, degenControlsRow, nextImageButton (at bottom)
    
    // Main Controls Row (Solo, Gender, Animated GIF)
    controlsRow1 = getOrCreateRow('sop-controls-row1', pluginContainer, nextImageButton); // Insert before nextImageButton if it exists
    soloToggleButton = createButtonInRow('sop-solo-toggle-button', null, "Toggle 'solo' filter", handleSoloToggleClick, controlsRow1, 'filter-button');
    maleButton = createButtonInRow('sop-male-button', 'Male', "Filter for 'male' tag", () => handleGenderButtonClick('male'), controlsRow1, 'filter-button');
    femaleButton = createButtonInRow('sop-female-button', 'Female', "Filter for 'female' tag", () => handleGenderButtonClick('female'), controlsRow1, 'filter-button');
    animatedButton = createButtonInRow('sop-animated-button', null, "Toggle GIF animation search", handleAnimatedButtonClick, controlsRow1, 'filter-button');

    // Degen Mode Button Container & Button
    degenModeButtonContainer = getOrCreateRow('sop-degen-mode-button-container', pluginContainer, nextImageButton);
    degenModeButton = createButtonInRow('sop-degen-mode-button', null, "Toggle Degen Mode", handleDegenModeToggleClick, degenModeButtonContainer, 'filter-button', 'sop-degen-master-button');
    console.log("SoP: Degen Mode master button created/fetched.");

    // Degen Tags Row (Scat, Diaper, Urine)
    degenControlsRow = getOrCreateRow('sop-controls-row-degen', pluginContainer, nextImageButton);
    scatButton = createButtonInRow('sop-scat-button', null, "Include 'scat' tag", () => handleIndividualDegenTagClick('scat'), degenControlsRow, 'filter-button', 'sop-degen-tag-button');
    diaperButton = createButtonInRow('sop-diaper-button', null, "Include 'diaper' tag", () => handleIndividualDegenTagClick('diaper'), degenControlsRow, 'filter-button', 'sop-degen-tag-button');
    urineButton = createButtonInRow('sop-urine-button', null, "Include 'urine' tag", () => handleIndividualDegenTagClick('urine'), degenControlsRow, 'filter-button', 'sop-degen-tag-button');
    console.log("SoP: Individual degen tag buttons created/fetched.");
    
    // "Next image" Button - ensure it's created last or its placeholder correctly handled by getOrCreateRow
    // For simplicity, let's ensure it's handled after other rows if it's a direct child of pluginContainer
    if (document.getElementById('sop-next-image-button')) { // If it was already handled as insertBefore target
        nextImageButton = document.getElementById('sop-next-image-button');
    } else { // Create it now and append last
        let tempNextButton = document.getElementById('sop-next-image-button');
        if (tempNextButton) tempNextButton.remove(); // remove if it exists elsewhere
        nextImageButton = document.createElement('button');
        nextImageButton.id = 'sop-next-image-button';
        nextImageButton.classList.add('action-button');
        nextImageButton.textContent = 'Next image';
        nextImageButton.title = "Get another random image";
        nextImageButton.addEventListener('click', handleNextImageButtonClick);
        pluginContainer.appendChild(nextImageButton); // Append last to pluginContainer
    }
    
    updateButtonAppearances();
}

function displayArtistInfo(artistTags) {
    ensurePluginContainer();
    if (!document.getElementById('sop-artist-info')) {
        artistInfoDiv = document.createElement('div');
        artistInfoDiv.id = 'sop-artist-info';
        // Insert artist info after the image if image exists, otherwise at the top of container
        const img = document.getElementById('sop-injected-image');
        if (img && img.parentNode === pluginContainer) {
            pluginContainer.insertBefore(artistInfoDiv, img.nextSibling);
        } else {
            pluginContainer.prepend(artistInfoDiv); // Add to top if image isn't there yet
        }
    } else {
        artistInfoDiv = document.getElementById('sop-artist-info');
    }

    if (artistTags && artistTags.length > 0) {
        artistInfoDiv.innerHTML = `Artist(s): <strong>${artistTags.join(', ')}</strong>`;
    } else {
        artistInfoDiv.innerHTML = 'Artist(s): Unknown';
    }
    artistInfoDiv.style.display = 'block';
    console.log("SoP: Artist info displayed.");
}

function displayImage(imageUrl, pokemonIdentifier, artistTags = []) {
  ensurePluginContainer(); // Ensure main container exists first

  // Image
  if (!document.getElementById('sop-injected-image')) {
      imageElement = document.createElement('img');
      imageElement.id = 'sop-injected-image';
      pluginContainer.prepend(imageElement); // Image at the top
  } else {
      imageElement = document.getElementById('sop-injected-image');
  }
  imageElement.src = imageUrl;
  imageElement.alt = "e621 image for Pokémon #" + pokemonIdentifier;
  
  displayArtistInfo(artistTags); // Display artist info (will place itself after image or at top)
  createOrShowControls(); // Create/recreate all buttons and their rows in order
  console.log("SoP: Image and controls displayed.");
}

function removeAllUI() {
  if (pluginContainer) {
    pluginContainer.remove();
    pluginContainer = null;
  }
  imageElement = null; artistInfoDiv = null; controlsRow1 = null; 
  degenModeButtonContainer = null; degenModeButton = null; degenControlsRow = null; 
  nextImageButton = null; soloToggleButton = null; maleButton = null; 
  femaleButton = null; animatedButton = null; scatButton = null; 
  diaperButton = null; urineButton = null;
  console.log("SoP: All UI removed.");
}

function checkForPokedexNumberAndUpdate() {
  const currentPokedexNumber = extractPokedexNumberFromPage();
  if (currentPokedexNumber !== previousPokedexNumber) {
    if (currentPokedexNumber) {
      console.log("SoP: Pokédex number change. New:", currentPokedexNumber);
      isSoloActive = true; activeGenderFilter = null; searchForAnimatedGif = false;
      isDegenModeOn = false; includeScat = false; includeDiaper = false; includeUrine = false;
      // UI will update on first image load for this new Pokémon
    } else if (previousPokedexNumber) {
      console.log("SoP: Pokédex number no longer found. Clearing UI.");
    }
  }

  if (currentPokedexNumber && currentPokedexNumber !== previousPokedexNumber) {
    previousPokedexNumber = currentPokedexNumber;
    triggerBackgroundSearch("FETCH_IMAGE_BY_POKEDEX_NUMBER", { pokedexNumber: currentPokedexNumber });
  } else if (!currentPokedexNumber && previousPokedexNumber) {
    previousPokedexNumber = null;
    removeAllUI();
  }
}

function initializeNumberChecker() {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(checkForPokedexNumberAndUpdate, 2000);
  console.log("SoP: Initializing number checker.");
  checkForPokedexNumberAndUpdate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNumberChecker);
} else {
  initializeNumberChecker();
}