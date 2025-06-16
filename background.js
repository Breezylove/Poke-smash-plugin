// background.js

const MY_USER_AGENT_GENERAL = "ChairmanbreezysSmashOrPass/1.6 (...);";
const MY_USER_AGENT_E621 = "ChairmanbreezysSmashOrPass/1.6 (... for e621);";

// YOUR HARDCODED E621 CREDENTIALS (as per your previous request to keep them)
const YOUR_E621_USERNAME = "Breezylove";
const YOUR_E621_API_KEY = "mm1fiHfPhK9Fsu6PwxuuhNXW";

let lastQueryState = {
  pokemonName: null,
  ratingFilter: null,
  e621Page: 1,
  isSoloActive: true,
  genderFilter: null,
  searchForGif: false,
  // Degen Mode related states
  isDegenModeOn: false, // Default OFF
  includeScat: false,
  includeDiaper: false,
  includeUrine: false
};

// Listen for installation (no changes here needed for this feature specifically)
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    chrome.storage.local.set({ showSetupMessageV1_5: true }); // This flag is for the API key setup, can be ignored if API key is hardcoded
  }
});

async function performSingleE621FetchAttempt(apiUrlBase, searchTagAttemptDisplay) {
  let finalApiUrl = apiUrlBase;
  if (YOUR_E621_USERNAME && YOUR_E621_API_KEY) {
    finalApiUrl += `&login=${encodeURIComponent(YOUR_E621_USERNAME)}&api_key=${encodeURIComponent(YOUR_E621_API_KEY)}`;
  }
  console.log("SoP: Fetching from e621:", finalApiUrl);

  const e621Response = await fetch(finalApiUrl, { method: 'GET', headers: { 'User-Agent': MY_USER_AGENT_E621 }});
  if (!e621Response.ok) {
    return { success: false, error: `e621 HTTP error ${e621Response.status} for '${searchTagAttemptDisplay}'.`, imageUrl: null, foundPosts: false, artistTags: [] };
  }
  const contentType = e621Response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return { success: false, error: `e621 Expected JSON for '${searchTagAttemptDisplay}'.`, imageUrl: null, foundPosts: false, artistTags: [] };
  }
  const e621Data = await e621Response.json();
  if (e621Data.posts && e621Data.posts.length > 0) {
    const post = e621Data.posts[0];
    let imageUrl = null;
    if (post.sample && post.sample.url && post.sample.width > 0) imageUrl = post.sample.url;
    else if (post.file && post.file.url && post.file.width > 0) imageUrl = post.file.url;
    else if (post.preview && post.preview.url && post.preview.width > 0) imageUrl = post.preview.url;
    
    const artistTags = post.tags && post.tags.artist ? post.tags.artist : [];

    if (imageUrl) return { success: true, imageUrl: imageUrl, error: null, foundPosts: true, artistTags: artistTags };
    return { success: false, error: `Image URL not found in e621 post data for '${searchTagAttemptDisplay}'.`, imageUrl: null, foundPosts: true, artistTags: artistTags };
  }
  return { success: false, imageUrl: null, error: null, foundPosts: false, artistTags: [] };
}

async function fetchE621ImageWithFallbacks(pokemonApiName, ratingFilter, page, isSoloActive, genderFilter, searchForGif, isDegenModeOn, includeScat, includeDiaper, includeUrine, sendResponseCallback) {
  const baseTagName = pokemonApiName.toLowerCase().replace(/-/g, '_');
  
  let tagsArray = ["pokemon", ratingFilter, "order:random"];
  if (isSoloActive) tagsArray.push("solo");
  if (genderFilter) tagsArray.push(genderFilter);
  if (searchForGif) tagsArray.push("gif"); 

  // Add degen tags based on Degen Mode state
  if (isDegenModeOn) {
    if (includeScat) tagsArray.push("scat");
    if (includeDiaper) tagsArray.push("diaper");
    if (includeUrine) tagsArray.push("urine");
  } else {
    // Degen Mode is OFF, apply negative default filters
    tagsArray.push("-scat", "-diaper", "-urine");
  }
  
  const commonQueryParts = tagsArray.filter(tag => tag && tag.trim() !== '').join(" ");

  const buildApiUrl = (specificPokemonTag) => {
      const e621Tags = `${specificPokemonTag} ${commonQueryParts}`.trim().replace(/\s+/g, ' ');
      return `https://e621.net/posts.json?tags=${encodeURIComponent(e621Tags)}&limit=1&page=${page}`;
  };

  // Attempt 1: Use baseTagName
  const tagNameAttempt1 = baseTagName;
  let result = await performSingleE621FetchAttempt(buildApiUrl(tagNameAttempt1), tagNameAttempt1); 
  if (result.success && result.imageUrl) {
    sendResponseCallback({ imageUrl: result.imageUrl, artistTags: result.artistTags }); return;
  }
  if (result.error) console.error("SoP: Attempt 1 e621 error:", result.error);
  else if (!result.foundPosts) console.log("SoP: Attempt 1: No posts found for tags including:", tagNameAttempt1);

  // Attempt 2: Use baseTagName_(pokemon)
  console.log("SoP: Attempt 1 failed, trying attempt 2...");
  const tagNameAttempt2 = `${baseTagName}_(pokemon)`;
  result = await performSingleE621FetchAttempt(buildApiUrl(tagNameAttempt2), tagNameAttempt2); 
  if (result.success && result.imageUrl) {
    sendResponseCallback({ imageUrl: result.imageUrl, artistTags: result.artistTags }); return;
  }
  if (result.error) console.error("SoP: Attempt 2 e621 error:", result.error);
  else if (!result.foundPosts) console.log("SoP: Attempt 2: No posts found for tags including:", tagNameAttempt2);
  
  const finalErrorMsg = `No e621 posts found for ${pokemonApiName} with current filters (tried '${tagNameAttempt1}' and '${tagNameAttempt2}'). DegenMode: ${isDegenModeOn}, Scat: ${includeScat}, Diaper: ${includeDiaper}, Urine: ${includeUrine}.`;
  sendResponseCallback({ error: finalErrorMsg, artistTags: [] });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let needsRefresh = false;
  let newPage = 1; // Default to page 1 for filter changes

  if (request.type === "FETCH_IMAGE_BY_POKEDEX_NUMBER") {
    const pokedexNumber = request.pokedexNumber;
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokedexNumber}`, { headers: { 'User-Agent': MY_USER_AGENT_GENERAL }})
    .then(response => {
      if (!response.ok) throw new Error(`PokeAPI HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(async pokemonData => {
      if (pokemonData && pokemonData.name) {
        const items = await chrome.storage.sync.get({ e621Rating: 'rating:safe' });
        lastQueryState.pokemonName = pokemonData.name;
        lastQueryState.ratingFilter = items.e621Rating ? items.e621Rating : 'rating:safe';
        lastQueryState.isSoloActive = request.soloState;
        lastQueryState.genderFilter = request.genderState;
        lastQueryState.searchForGif = request.animatedGifState;
        lastQueryState.isDegenModeOn = request.degenModeState; // Initialize from content.js
        lastQueryState.includeScat = request.includeScatState;
        lastQueryState.includeDiaper = request.includeDiaperState;
        lastQueryState.includeUrine = request.includeUrineState;
        lastQueryState.e621Page = 1;
        needsRefresh = true;
      } else throw new Error("Pokémon name not found in PokeAPI response.");
    })
    .catch(error => { sendResponse({ error: `PokeAPI Error: ${error.message}` }); })
    .finally(() => {
        if(needsRefresh && lastQueryState.pokemonName) {
            fetchE621ImageWithFallbacks(lastQueryState.pokemonName, lastQueryState.ratingFilter, lastQueryState.e621Page, lastQueryState.isSoloActive, lastQueryState.genderFilter, lastQueryState.searchForGif, lastQueryState.isDegenModeOn, lastQueryState.includeScat, lastQueryState.includeDiaper, lastQueryState.includeUrine, sendResponse);
        }
    });
    return true;
  }
  else if (request.type === "FETCH_NEXT_E621_IMAGE") {
    if (!lastQueryState.pokemonName) { sendResponse({ error: "No previous search." }); return false; }
    lastQueryState.e621Page++;
    newPage = lastQueryState.e621Page;
    needsRefresh = true;
  }
  else if (request.type === "SET_SOLO_FILTER_AND_REFRESH") {
    if (!lastQueryState.pokemonName) { sendResponse({ error: "No Pokémon identified."}); return false; }
    lastQueryState.isSoloActive = request.soloState;
    needsRefresh = true;
  }
  else if (request.type === "SET_GENDER_FILTER_AND_REFRESH") {
    if (!lastQueryState.pokemonName) { sendResponse({ error: "No Pokémon identified."}); return false; }
    lastQueryState.genderFilter = request.genderFilter;
    needsRefresh = true;
  }
  else if (request.type === "SET_ANIMATED_GIF_FILTER_AND_REFRESH") { 
    if (!lastQueryState.pokemonName) { sendResponse({ error: "No Pokémon identified."}); return false; }
    lastQueryState.searchForGif = request.animatedGifState;
    needsRefresh = true;
  }
  else if (request.type === "SET_DEGEN_MODE_AND_REFRESH") {
    if (!lastQueryState.pokemonName) { sendResponse({ error: "No Pokémon identified."}); return false; }
    lastQueryState.isDegenModeOn = request.degenModeState;
    // When degen mode is turned off, ensure positive degen tags are off
    // When turned on, content.js sends their current (likely off) state.
    lastQueryState.includeScat = request.includeScat; 
    lastQueryState.includeDiaper = request.includeDiaper;
    lastQueryState.includeUrine = request.includeUrine;
    needsRefresh = true;
  }
  else if (request.type === "SET_INDIVIDUAL_DEGEN_TAG_AND_REFRESH") {
    if (!lastQueryState.pokemonName || !lastQueryState.isDegenModeOn) { sendResponse({ error: "Degen mode is off or no Pokémon identified."}); return false; }
    if (request.tagType === 'scat') lastQueryState.includeScat = request.activeState;
    else if (request.tagType === 'diaper') lastQueryState.includeDiaper = request.activeState;
    else if (request.tagType === 'urine') lastQueryState.includeUrine = request.activeState;
    needsRefresh = true;
  }

  if (needsRefresh && lastQueryState.pokemonName) {
    if (request.type !== "FETCH_NEXT_E621_IMAGE") { // Reset page for filter changes
        lastQueryState.e621Page = 1;
    }
    fetchE621ImageWithFallbacks(
        lastQueryState.pokemonName, lastQueryState.ratingFilter, 
        lastQueryState.e621Page, lastQueryState.isSoloActive, 
        lastQueryState.genderFilter, lastQueryState.searchForGif,
        lastQueryState.isDegenModeOn, lastQueryState.includeScat,
        lastQueryState.includeDiaper, lastQueryState.includeUrine,
        sendResponse
    );
    return true; // Keep channel open for async response
  } else if (needsRefresh && !lastQueryState.pokemonName) {
    sendResponse({ error: "Cannot refresh, no Pokémon identified." });
    return false;
  }
  // If no specific handler matched or no refresh needed, channel might close.
  // For unhandled types, you might want 'return false;' if response is synchronous or not sent.
});