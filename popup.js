// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const ratingSelect = document.getElementById('ratingSelect');
  const usernameInput = document.getElementById('e621Username');
  const apiKeyInput = document.getElementById('e621ApiKey');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');
  const setupMessageDiv = document.getElementById('setupMessage');

  // Load saved settings
  chrome.storage.sync.get(
    { 
      e621Rating: 'rating:safe',
      e621Username: '',
      e621ApiKey: ''
    }, (syncItems) => {
      const validRatings = ['rating:safe', 'rating:questionable', 'rating:explicit', ''];
      if (validRatings.includes(syncItems.e621Rating)) {
        ratingSelect.value = syncItems.e621Rating;
      } else {
        ratingSelect.value = 'rating:safe'; 
      }
      usernameInput.value = syncItems.e621Username || '';
      apiKeyInput.value = syncItems.e621ApiKey || '';

      // Check if we should show the setup message
      chrome.storage.local.get({ showSetupMessageV1_5: true }, (localItems) => { // Use a versioned key for the flag
        if (localItems.showSetupMessageV1_5 && (!syncItems.e621Username || !syncItems.e621ApiKey)) {
          setupMessageDiv.style.display = 'block';
        }
      });
    }
  );

  saveButton.addEventListener('click', () => {
    const selectedRating = ratingSelect.value;
    const enteredUsername = usernameInput.value.trim();
    const enteredApiKey = apiKeyInput.value.trim();

    chrome.storage.sync.set(
      { 
        e621Rating: selectedRating,
        e621Username: enteredUsername,
        e621ApiKey: enteredApiKey
      }, () => {
        statusDiv.textContent = 'Settings saved!';
        statusDiv.style.color = '#28a745';
        console.log('ChairmanbreezysSmashOrPass: Settings saved.');
        
        // Hide setup message after first save if credentials were provided or user explicitly saved
        chrome.storage.local.set({ showSetupMessageV1_5: false });
        setupMessageDiv.style.display = 'none';

        setTimeout(() => {
          statusDiv.textContent = ''; 
        }, 2000);
      }
    );
  });
});