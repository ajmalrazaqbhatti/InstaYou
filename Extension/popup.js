// Function to send alert to the page instead of showing in the popup
function showPageAlert(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: (alertMsg) => {
          alert(alertMsg);
        },
        args: [message]
      });
    }
  });
}

// Main download button functionality
document.getElementById("downloadBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: storeFollowerCounts,
    });
  });
});

// Compare button functionality
document.getElementById("compareBtn").addEventListener("click", () => {
  showSavedUsersList();
});

// Back button functionality
document.getElementById("backButton").addEventListener("click", () => {
  // Hide comparison UI elements
  document.getElementById("author").style.display="block";
  document.getElementById("userList").style.display = "none";
  document.getElementById("compareResults").style.display = "none";
  document.getElementById("backButton").style.display = "none";
  document.getElementById("clearListBtn").style.display = "none";
  
  // Show main UI elements
  document.getElementById("mainButtons").style.display = "flex";
  document.getElementById("mainText").textContent = "Upgrade Your Stalking Skills 🚀";
});

// Show list of saved users from Chrome storage
function showSavedUsersList() {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";
  
  // Show user list, hide main buttons
  userList.style.display = "flex";
  document.getElementById("mainButtons").style.display = "none";
  document.getElementById("backButton").style.display = "block";
  document.getElementById("author").style.display="none";
  document.getElementById("clearListBtn").style.display = "block";
  document.getElementById("mainText").textContent = "Select a user to compare stats";
  
  // THIS IS THE CRITICAL FIX: Use chrome.storage.local instead of localStorage
  chrome.storage.local.get(null, (items) => {
    
    // Get all keys that start with "instagram_stats_"
    const savedUsers = new Set();
    for (const key in items) {
      
      if (key && key.startsWith("instagram_stats_")) {
        const username = key.replace("instagram_stats_", "");
        savedUsers.add(username);
      }
    }
    
    
    // If no saved users, show message
    if (savedUsers.size === 0) {
      userList.innerHTML = "<div class='user-item'>No saved users found</div>";
      return;
    }
    
    // Add each user to the list
    savedUsers.forEach(username => {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        if (confirm(`Are you sure you want to delete stats for ${username}?`)) {
          const storageKey = `instagram_stats_${username}`;
          chrome.storage.local.remove(storageKey, () => {
            showPageAlert(`Cleared stored stats for ${username}`);
            showSavedUsersList();
          });
        }
      });
      deleteButton.className = "delete-button";
      const useritemname = document.createElement("div");
      useritemname.innerText = username;
      const userItem = document.createElement("div");
      userItem.className = "user-item";
      userItem.appendChild(useritemname);
      useritemname.addEventListener("click", () => {
        compareUserStats(username);
      });
      userItem.appendChild(deleteButton);
      userList.appendChild(userItem);
    });
  });
}

// Compare user stats and show results
function compareUserStats(username) {
  document.getElementById("clearListBtn").style.display = "none";
  
  // Get the current tab to run script on
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: compareWithSavedStats,
      args: [username]
    }).then(() => {
    }).catch(error => {
      document.getElementById("compareResults").innerHTML = 
        `<div class="error">Error: ${error.message}</div>`;
      document.getElementById("compareResults").style.display = "block";
    });
  });
}

// This function runs in the context of the Instagram page
function compareWithSavedStats(usernameToCompare) {
  // Check if we're on Instagram
  if (!window.location.href.includes("instagram.com/")) {
    alert("This script only works on Instagram pages");
    return;
  }
  
  // Extract username from current URL
  const urlPath = window.location.pathname;
  const currentUsername = urlPath.split("/")[1];
  
  // Verify we're on the correct profile
  if (currentUsername !== usernameToCompare) {
    alert(`Please navigate to ${usernameToCompare}'s profile to compare stats`);
    return;
  }
  
  const { followerCount, followingCount } = getCountsFromPage();
  
  if (followerCount === null && followingCount === null) {
    alert("Could not find follower and following counts on this page");
    return;
  }
  
  // Use the provided timestamp
  const formattedDateTime = new Date().toLocaleString();
  
  // Create message to send back to popup for chrome.storage access
  chrome.runtime.sendMessage({
    action: "getStoredData",
    username: usernameToCompare,
    followerCount: followerCount,
    followingCount: followingCount,
    timestamp: formattedDateTime,
  });
  
  // Get follower and following counts from the page
  function getCountsFromPage() {
    try {
      // For Instagram's new UI, the counts are typically in sections with specific order
      // Selector for the section that contains follower/following counts
      const sections = document.querySelectorAll('section ul li');
      
      let followerCount = null;
      let followingCount = null;
      
      // Instagram profile metrics are typically ordered: Posts, Followers, Following
      if (sections && sections.length >= 3) {
        // Try to extract from the text content, looking for spans with numbers
        sections.forEach((section, index) => {
          const countText = section.textContent;
          
          // Usually the 2nd item (index 1) is followers, 3rd item (index 2) is following
          if (index === 1 && countText.includes('follower')) {
            followerCount = extractNumberFromText(countText);
          } else if (index === 2 && countText.includes('following')) {
            followingCount = extractNumberFromText(countText);
          }
        });
      }
      
      // If we couldn't find them in the sections, try an alternative method
      if (followerCount === null || followingCount === null) {
        // Alternative selector to find links with follower/following counts
        const links = document.querySelectorAll('a[href*="/' + currentUsername + '/"]');
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent;
          
          // Extract counts from the link text
          if (href.includes('/followers/')) {
            followerCount = extractNumberFromText(text);
          } else if (href.includes('/following/')) {
            followingCount = extractNumberFromText(text);
          }
        });
      }

      // If still not found, try one last method with spans
      if (followerCount === null || followingCount === null) {
        // Look for spans with numbers
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent.trim();
          if (text && /^[\d,.]+[KkMm]?$/.test(text)) {
            // Found a span with just a number, check parent element text
            const parentText = span.parentElement.textContent.toLowerCase();
            
            if (parentText.includes('follower') && followerCount === null) {
              followerCount = extractNumberFromText(text);
            } else if (parentText.includes('following') && followingCount === null) {
              followingCount = extractNumberFromText(text);
            }
          }
        }
      }

      return { followerCount, followingCount };
    } catch (error) {
      return { followerCount: null, followingCount: null };
    }
  }
  
  // Helper function to extract numbers from text (e.g., "1,234" or "1.2K")
  function extractNumberFromText(text) {
    if (!text) {
      return null;
    }
    
    
    // First find any number-like pattern in the text
    const matches = text.match(/[\d,]+(\.\d+)?[KkMm]?/);
    if (!matches || matches.length === 0) {
      return null;
    }
    
    let numStr = matches[0];
    
    // Handle formats like 1.2K, 1.2M, etc.
    if (numStr.match(/[KkMm]$/)) {
      const multiplier = numStr.endsWith('K') || numStr.endsWith('k') ? 1000 : 1000000;
      const baseNum = parseFloat(numStr.replace(/[KkMm]$/, ''));
      const result = Math.round(baseNum * multiplier);
      return result;
    } else {
      // Remove commas and any non-numeric characters
      const result = parseInt(numStr.replace(/,/g, ''));
      return result;
    }
  }
}

// Function to store follower counts
function storeFollowerCounts() {

  // Check if we're on Instagram
  if (!window.location.href.includes("instagram.com/")) {
    alert("This script only works on Instagram pages");
    return;
  }

  // Extract username from URL
  const urlPath = window.location.pathname;
  const username = urlPath.split("/")[1];

  if (!username) {
    alert("Could not detect Instagram username");
    return;
  }

  function getCountsFromPage() {
    try {
      // For Instagram's new UI, the counts are typically in sections with specific order
      // Selector for the section that contains follower/following counts
      const sections = document.querySelectorAll('section ul li');
      
      let followerCount = null;
      let followingCount = null;
      
      // Instagram profile metrics are typically ordered: Posts, Followers, Following
      if (sections && sections.length >= 3) {
        // Try to extract from the text content, looking for spans with numbers
        sections.forEach((section, index) => {
          const countText = section.textContent;
          
          // Usually the 2nd item (index 1) is followers, 3rd item (index 2) is following
          if (index === 1 && countText.includes('follower')) {
            followerCount = extractNumberFromText(countText);
          } else if (index === 2 && countText.includes('following')) {
            followingCount = extractNumberFromText(countText);
          }
        });
      }
      
      // If we couldn't find them in the sections, try an alternative method
      if (followerCount === null || followingCount === null) {
        // Alternative selector to find links with follower/following counts
        const links = document.querySelectorAll('a[href*="/' + username + '/"]');
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent;
          
          // Extract counts from the link text
          if (href.includes('/followers/')) {
            followerCount = extractNumberFromText(text);
          } else if (href.includes('/following/')) {
            followingCount = extractNumberFromText(text);
          }
        });
      }

      // If still not found, try one last method with spans
      if (followerCount === null || followingCount === null) {
        // Look for spans with numbers
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent.trim();
          if (text && /^[\d,.]+[KkMm]?$/.test(text)) {
            // Found a span with just a number, check parent element text
            const parentText = span.parentElement.textContent.toLowerCase();
            
            if (parentText.includes('follower') && followerCount === null) {
              followerCount = extractNumberFromText(text);
            } else if (parentText.includes('following') && followingCount === null) {
              followingCount = extractNumberFromText(text);
            }
          }
        }
      }

      return { followerCount, followingCount };
    } catch (error) {
      return { followerCount: null, followingCount: null };
    }
  }

  // Helper function to extract numbers from text (e.g., "1,234" or "1.2K")
  function extractNumberFromText(text) {
    if (!text) {
      return null;
    }
    
    
    // First find any number-like pattern in the text
    const matches = text.match(/[\d,]+(\.\d+)?[KkMm]?/);
    if (!matches || matches.length === 0) {
      return null;
    }
    
    let numStr = matches[0];
    
    // Handle formats like 1.2K, 1.2M, etc.
    if (numStr.match(/[KkMm]$/)) {
      const multiplier = numStr.endsWith('K') || numStr.endsWith('k') ? 1000 : 1000000;
      const baseNum = parseFloat(numStr.replace(/[KkMm]$/, ''));
      const result = Math.round(baseNum * multiplier);
      return result;
    } else {
      // Remove commas and any non-numeric characters
      const result = parseInt(numStr.replace(/,/g, ''));
      return result;
    }
  }

  // Get the counts
  const { followerCount, followingCount } = getCountsFromPage();
  
  if (followerCount === null && followingCount === null) {
    alert("Could not find follower and following counts");
    return;
  }

  // Use the provided timestamp and user

  // Create data object to store
  const data = {
    username: username,
    followerCount: followerCount,
    followingCount: followingCount,
    timestamp: Date().toLocaleString()
  };

  // Use chrome.runtime.sendMessage to access chrome.storage from popup
  chrome.runtime.sendMessage({
    action: "storeData",
    key: `instagram_stats_${username}`,
    data: data
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message) => {
  
  if (message.action === "showCompareResults") {
    document.getElementById("userList").style.display = "none";
    const resultsDiv = document.getElementById("compareResults");
    resultsDiv.innerHTML = message.data;
    resultsDiv.style.display = "flex";
    document.getElementById("backButton").style.display = "block";
    document.getElementById("clearListBtn").style.display = "block";
  }
  else if (message.action === "storeData") {
    const storageKey = message.key;
    chrome.storage.local.get([storageKey], (result) => {
      let dataArray = [];
      if (result[storageKey]) {
        try {
          dataArray = JSON.parse(result[storageKey]);
          if (!Array.isArray(dataArray)) {
            dataArray = [dataArray];
          }
          if (dataArray.length > 0) {
            const lastEntry = dataArray[dataArray.length - 1];
            if (lastEntry.followerCount === message.data.followerCount && 
                lastEntry.followingCount === message.data.followingCount) {
              showPageAlert(`Stats for ${message.data.username} is already up to date.`);
              return;
            }
          }
        } catch (e) {
          dataArray = [];
        }
      }
      
      dataArray.push(message.data);
      chrome.storage.local.set({[storageKey]: JSON.stringify(dataArray)}, () => {
        showPageAlert(`Stored stats for ${message.data.username}:\nDate: ${message.data.timestamp}\nFollowers: ${message.data.followerCount}\nFollowing: ${message.data.followingCount}`);
      });
    });
  }
  else if (message.action === "getStoredData") {
    const storageKey = `instagram_stats_${message.username}`;
    
    chrome.storage.local.get([storageKey], (result) => {
      let dataArray = [];
      let lastEntry = null;
      
      if (result[storageKey]) {
        try {
          dataArray = JSON.parse(result[storageKey]);
          if (!Array.isArray(dataArray)) {
            dataArray = [dataArray];
          }
          
          if (dataArray.length > 0) {
            lastEntry = dataArray[dataArray.length - 1];
          }
        } catch (e) {
          dataArray = [];
        }
      }
      
      if (!lastEntry) {
        // No previous data, store initial data
        const initialData = [{
          username: message.username,
          followerCount: message.followerCount,
          followingCount: message.followingCount,
          timestamp: message.timestamp
        }];
        
        chrome.storage.local.set({[storageKey]: JSON.stringify(initialData)}, () => {
          
          // Show results div with initial data message
          const resultsDiv = document.getElementById("compareResults");
          resultsDiv.innerHTML = `
            <h3>Initial data for ${message.username}</h3>
            <p>First recorded stats:</p>
            <p>Date: ${message.timestamp}</p>
            <p>Followers: ${message.followerCount}</p>
            <p>Following: ${message.followingCount}</p>
            <p>Check back later to see changes!</p>
          `;
          document.getElementById("userList").style.display = "none";
          resultsDiv.style.display = "flex";
          document.getElementById("backButton").style.display = "block";
          document.getElementById("clearListBtn").style.display = "block";
        });
        return;
      }
      
      // Calculate changes
      const followerChange = message.followerCount - lastEntry.followerCount;
      const followingChange = message.followingCount - lastEntry.followingCount;
      
      // Check if this is a duplicate
      const isDuplicate = 
        lastEntry.followerCount === message.followerCount && 
        lastEntry.followingCount === message.followingCount;
      
      // Only add if not a duplicate
      if (!isDuplicate) {
        const newData = {
          username: message.username,
          followerCount: message.followerCount,
          followingCount: message.followingCount,
          timestamp: message.timestamp
        };
        
        dataArray.push(newData);
        chrome.storage.local.set({[storageKey]: JSON.stringify(dataArray)});
      }
    
      function getChangeClass(change) {
        if (change > 0) return "change-positive";
        if (change < 0) return "change-negative";
        return "change-neutral";
      }
      
      function formatChange(change) {
        if (change > 0) return "+" + change;
        return change.toString();
      }
      
      const resultHTML = `
        <p>Last update: ${lastEntry.timestamp || "Unknown"}</p>
        <p>Current update: ${message.timestamp}</p>
        <p>Followers: ${lastEntry.followerCount || 0} → ${message.followerCount} 
           <span class="${getChangeClass(followerChange)}">
             (${formatChange(followerChange)})
           </span>
        </p>
        <p>Following: ${lastEntry.followingCount || 0} → ${message.followingCount} 
           <span class="${getChangeClass(followingChange)}">
             (${formatChange(followingChange)})
           </span>
        </p>
      `;
      
      // Show results
      const resultsDiv = document.getElementById("compareResults");
      resultsDiv.classList.add("compare-results");
      resultsDiv.innerHTML = resultHTML;

      document.getElementById("userList").style.display = "none";
      resultsDiv.style.display = "flex";
      document.getElementById("backButton").style.display = "block";
    });
  }
});

chrome.storage.local.get(null, (items) => {
  let count = 0;
  for (const key in items) {
    if (key.startsWith("instagram_stats_")) {
      count++;
    }
  }
});
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("clearListBtn")?.addEventListener("click", clearStoredData);
});
function clearStoredData() {
  
  // If we're in the comparison view for a specific user
  if (document.getElementById("compareResults").style.display === "block") {
    // Extract username from the comparison results heading
    const heading = document.getElementById("compareResults").querySelector("h3");
    if (heading && heading.textContent) {
      const match = heading.textContent.match(/Comparison for (.+)/) || 
                   heading.textContent.match(/Initial data for (.+)/);
      
      if (match && match[1]) {
        const username = match[1];
        const storageKey = `instagram_stats_${username}`;
        
        if (username) {
          chrome.storage.local.remove(storageKey, () => {
            showPageAlert(`Cleared stored stats for ${username}`);
            document.getElementById("backButton").click();
          });
        }
        return;
      }
    }
  }
  
  // If we're in the user list view or couldn't determine specific user
  if (confirm("Are you sure you want to clear ALL stored Instagram data?")) {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = [];
      for (const key in items) {
        if (key.startsWith("instagram_stats_")) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          showPageAlert(`Cleared all stored Instagram stats (${keysToRemove.length} profiles)`);
          
          // Return to main view
          document.getElementById("backButton").click();
        });
      } else {
        showPageAlert("No stored data to clear");
      }
    });
  }
}