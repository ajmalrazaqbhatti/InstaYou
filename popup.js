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
  console.log("Compare button clicked");
  showSavedUsersList();
});

// Back button functionality
document.getElementById("backButton").addEventListener("click", () => {
  console.log("Back button clicked");
  // Hide comparison UI elements
  document.getElementById("userList").style.display = "none";
  document.getElementById("compareResults").style.display = "none";
  document.getElementById("backButton").style.display = "none";
  
  // Show main UI elements
  document.getElementById("mainButtons").style.display = "flex";
  document.getElementById("mainText").textContent = "Lvl Up The Stalking Game with full Rizzzz";
});

// Show list of saved users from Chrome storage
function showSavedUsersList() {
  console.log("Showing saved users list");
  const userList = document.getElementById("userList");
  userList.innerHTML = "";
  
  // Show user list, hide main buttons
  userList.style.display = "block";
  document.getElementById("mainButtons").style.display = "none";
  document.getElementById("backButton").style.display = "block";
  document.getElementById("mainText").textContent = "Select a user to compare:";
  
  // THIS IS THE CRITICAL FIX: Use chrome.storage.local instead of localStorage
  chrome.storage.local.get(null, (items) => {
    console.log("All storage items:", items);
    
    // Get all keys that start with "instagram_stats_"
    const savedUsers = new Set();
    for (const key in items) {
      console.log(`Checking key: ${key}`);
      
      if (key && key.startsWith("instagram_stats_")) {
        const username = key.replace("instagram_stats_", "");
        console.log(`Found user: ${username}`);
        savedUsers.add(username);
      }
    }
    
    console.log(`Found ${savedUsers.size} saved users`);
    
    // If no saved users, show message
    if (savedUsers.size === 0) {
      console.log("No saved users found");
      userList.innerHTML = "<div class='user-item'>No saved users found</div>";
      return;
    }
    
    // Add each user to the list
    savedUsers.forEach(username => {
      console.log(`Adding ${username} to the list`);
      const userItem = document.createElement("div");
      userItem.className = "user-item";
      userItem.textContent = username;
      userItem.addEventListener("click", () => {
        console.log(`Selected user: ${username}`);
        compareUserStats(username);
      });
      userList.appendChild(userItem);
    });
  });
}

// Compare user stats and show results
function compareUserStats(username) {
  console.log(`Comparing stats for: ${username}`);
  
  // Get the current tab to run script on
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log("Found current tab:", tabs[0].url);
    
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: compareWithSavedStats,
      args: [username]
    }).then(() => {
      console.log("Script executed successfully");
    }).catch(error => {
      console.error("Error executing script:", error);
      document.getElementById("compareResults").innerHTML = 
        `<div class="error">Error: ${error.message}</div>`;
      document.getElementById("compareResults").style.display = "block";
    });
  });
}

// This function runs in the context of the Instagram page
function compareWithSavedStats(usernameToCompare) {
  console.log("compareWithSavedStats executing in Instagram page");
  console.log("Comparing stats for:", usernameToCompare);
  
  // Check if we're on Instagram
  if (!window.location.href.includes("instagram.com/")) {
    console.error("Not on Instagram");
    alert("This script only works on Instagram pages");
    return;
  }
  
  // Extract username from current URL
  const urlPath = window.location.pathname;
  const currentUsername = urlPath.split("/")[1];
  console.log("Current page username:", currentUsername);
  
  // Verify we're on the correct profile
  if (currentUsername !== usernameToCompare) {
    console.error("Username mismatch");
    alert(`Please navigate to ${usernameToCompare}'s profile to compare stats`);
    return;
  }
  
  // Get current follower and following counts
  console.log("Getting current counts from page");
  const { followerCount, followingCount } = getCountsFromPage();
  console.log("Current counts:", { followerCount, followingCount });
  
  if (followerCount === null && followingCount === null) {
    console.error("Failed to get counts");
    alert("Could not find follower and following counts on this page");
    return;
  }
  
  // Use the provided timestamp
  const formattedDateTime = "2025-03-20 18:07:38";
  const currentUser = "ajmalrazaqbhatti";
  console.log("Using timestamp:", formattedDateTime);
  console.log("Current user:", currentUser);
  
  // Create message to send back to popup for chrome.storage access
  chrome.runtime.sendMessage({
    action: "getStoredData",
    username: usernameToCompare,
    followerCount: followerCount,
    followingCount: followingCount,
    timestamp: formattedDateTime,
    currentUser: currentUser
  });
  
  // Get follower and following counts from the page
  function getCountsFromPage() {
    try {
      console.log("Executing getCountsFromPage");
      // For Instagram's new UI, the counts are typically in sections with specific order
      // Selector for the section that contains follower/following counts
      const sections = document.querySelectorAll('section ul li');
      console.log("Found sections:", sections.length);
      
      let followerCount = null;
      let followingCount = null;
      
      // Instagram profile metrics are typically ordered: Posts, Followers, Following
      if (sections && sections.length >= 3) {
        console.log("Processing sections for counts");
        // Try to extract from the text content, looking for spans with numbers
        sections.forEach((section, index) => {
          const countText = section.textContent;
          console.log(`Section ${index} text:`, countText);
          
          // Usually the 2nd item (index 1) is followers, 3rd item (index 2) is following
          if (index === 1 && countText.includes('follower')) {
            followerCount = extractNumberFromText(countText);
            console.log("Found follower count in section:", followerCount);
          } else if (index === 2 && countText.includes('following')) {
            followingCount = extractNumberFromText(countText);
            console.log("Found following count in section:", followingCount);
          }
        });
      }
      
      // If we couldn't find them in the sections, try an alternative method
      if (followerCount === null || followingCount === null) {
        console.log("Using alternative method to find counts");
        // Alternative selector to find links with follower/following counts
        const links = document.querySelectorAll('a[href*="/' + currentUsername + '/"]');
        console.log("Found links:", links.length);
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent;
          console.log("Link href:", href, "text:", text);
          
          // Extract counts from the link text
          if (href.includes('/followers/')) {
            followerCount = extractNumberFromText(text);
            console.log("Found follower count in link:", followerCount);
          } else if (href.includes('/following/')) {
            followingCount = extractNumberFromText(text);
            console.log("Found following count in link:", followingCount);
          }
        });
      }

      // If still not found, try one last method with spans
      if (followerCount === null || followingCount === null) {
        console.log("Using final method to find counts with spans");
        // Look for spans with numbers
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent.trim();
          if (text && /^[\d,.]+[KkMm]?$/.test(text)) {
            // Found a span with just a number, check parent element text
            const parentText = span.parentElement.textContent.toLowerCase();
            console.log("Found number span:", text, "parent text:", parentText);
            
            if (parentText.includes('follower') && followerCount === null) {
              followerCount = extractNumberFromText(text);
              console.log("Found follower count in span:", followerCount);
            } else if (parentText.includes('following') && followingCount === null) {
              followingCount = extractNumberFromText(text);
              console.log("Found following count in span:", followingCount);
            }
          }
        }
      }

      console.log("Final extracted counts:", { followerCount, followingCount });
      return { followerCount, followingCount };
    } catch (error) {
      console.error("Error getting counts:", error);
      return { followerCount: null, followingCount: null };
    }
  }
  
  // Helper function to extract numbers from text (e.g., "1,234" or "1.2K")
  function extractNumberFromText(text) {
    if (!text) {
      console.log("No text provided to extract number from");
      return null;
    }
    
    console.log("Extracting number from:", text);
    
    // First find any number-like pattern in the text
    const matches = text.match(/[\d,]+(\.\d+)?[KkMm]?/);
    if (!matches || matches.length === 0) {
      console.log("No number pattern found in text");
      return null;
    }
    
    let numStr = matches[0];
    console.log("Matched number string:", numStr);
    
    // Handle formats like 1.2K, 1.2M, etc.
    if (numStr.match(/[KkMm]$/)) {
      const multiplier = numStr.endsWith('K') || numStr.endsWith('k') ? 1000 : 1000000;
      const baseNum = parseFloat(numStr.replace(/[KkMm]$/, ''));
      const result = Math.round(baseNum * multiplier);
      console.log(`Converted ${numStr} to ${result}`);
      return result;
    } else {
      // Remove commas and any non-numeric characters
      const result = parseInt(numStr.replace(/,/g, ''));
      console.log(`Converted ${numStr} to ${result}`);
      return result;
    }
  }
}

// Function to store follower counts
function storeFollowerCounts() {
  console.log("storeFollowerCounts executing");

  // Check if we're on Instagram
  if (!window.location.href.includes("instagram.com/")) {
    console.error("Not on Instagram");
    alert("This script only works on Instagram pages");
    return;
  }

  // Extract username from URL
  const urlPath = window.location.pathname;
  const username = urlPath.split("/")[1];
  console.log("Detected username:", username);

  if (!username) {
    console.error("No username detected");
    alert("Could not detect Instagram username");
    return;
  }

  // Get follower and following counts from the page
  console.log("Getting counts from page");
  function getCountsFromPage() {
    try {
      console.log("Executing getCountsFromPage");
      // For Instagram's new UI, the counts are typically in sections with specific order
      // Selector for the section that contains follower/following counts
      const sections = document.querySelectorAll('section ul li');
      console.log("Found sections:", sections.length);
      
      let followerCount = null;
      let followingCount = null;
      
      // Instagram profile metrics are typically ordered: Posts, Followers, Following
      if (sections && sections.length >= 3) {
        console.log("Processing sections for counts");
        // Try to extract from the text content, looking for spans with numbers
        sections.forEach((section, index) => {
          const countText = section.textContent;
          console.log(`Section ${index} text:`, countText);
          
          // Usually the 2nd item (index 1) is followers, 3rd item (index 2) is following
          if (index === 1 && countText.includes('follower')) {
            followerCount = extractNumberFromText(countText);
            console.log("Found follower count in section:", followerCount);
          } else if (index === 2 && countText.includes('following')) {
            followingCount = extractNumberFromText(countText);
            console.log("Found following count in section:", followingCount);
          }
        });
      }
      
      // If we couldn't find them in the sections, try an alternative method
      if (followerCount === null || followingCount === null) {
        console.log("Using alternative method to find counts");
        // Alternative selector to find links with follower/following counts
        const links = document.querySelectorAll('a[href*="/' + username + '/"]');
        console.log("Found links:", links.length);
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent;
          console.log("Link href:", href, "text:", text);
          
          // Extract counts from the link text
          if (href.includes('/followers/')) {
            followerCount = extractNumberFromText(text);
            console.log("Found follower count in link:", followerCount);
          } else if (href.includes('/following/')) {
            followingCount = extractNumberFromText(text);
            console.log("Found following count in link:", followingCount);
          }
        });
      }

      // If still not found, try one last method with spans
      if (followerCount === null || followingCount === null) {
        console.log("Using final method to find counts with spans");
        // Look for spans with numbers
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent.trim();
          if (text && /^[\d,.]+[KkMm]?$/.test(text)) {
            // Found a span with just a number, check parent element text
            const parentText = span.parentElement.textContent.toLowerCase();
            console.log("Found number span:", text, "parent text:", parentText);
            
            if (parentText.includes('follower') && followerCount === null) {
              followerCount = extractNumberFromText(text);
              console.log("Found follower count in span:", followerCount);
            } else if (parentText.includes('following') && followingCount === null) {
              followingCount = extractNumberFromText(text);
              console.log("Found following count in span:", followingCount);
            }
          }
        }
      }

      console.log("Final extracted counts:", { followerCount, followingCount });
      return { followerCount, followingCount };
    } catch (error) {
      console.error("Error getting counts:", error);
      return { followerCount: null, followingCount: null };
    }
  }

  // Helper function to extract numbers from text (e.g., "1,234" or "1.2K")
  function extractNumberFromText(text) {
    if (!text) {
      console.log("No text provided to extract number from");
      return null;
    }
    
    console.log("Extracting number from:", text);
    
    // First find any number-like pattern in the text
    const matches = text.match(/[\d,]+(\.\d+)?[KkMm]?/);
    if (!matches || matches.length === 0) {
      console.log("No number pattern found in text");
      return null;
    }
    
    let numStr = matches[0];
    console.log("Matched number string:", numStr);
    
    // Handle formats like 1.2K, 1.2M, etc.
    if (numStr.match(/[KkMm]$/)) {
      const multiplier = numStr.endsWith('K') || numStr.endsWith('k') ? 1000 : 1000000;
      const baseNum = parseFloat(numStr.replace(/[KkMm]$/, ''));
      const result = Math.round(baseNum * multiplier);
      console.log(`Converted ${numStr} to ${result}`);
      return result;
    } else {
      // Remove commas and any non-numeric characters
      const result = parseInt(numStr.replace(/,/g, ''));
      console.log(`Converted ${numStr} to ${result}`);
      return result;
    }
  }

  // Get the counts
  const { followerCount, followingCount } = getCountsFromPage();
  console.log("Retrieved counts:", { followerCount, followingCount });
  
  if (followerCount === null && followingCount === null) {
    console.error("Failed to find counts");
    alert("Could not find follower and following counts");
    return;
  }

  // Use the provided timestamp and user
  const formattedDateTime = "2025-03-20 18:07:38";
  const currentUser = "ajmalrazaqbhatti";
  console.log("Using timestamp:", formattedDateTime);
  console.log("Current user:", currentUser);

  // Create data object to store
  const data = {
    username: username,
    followerCount: followerCount,
    followingCount: followingCount,
    timestamp: formattedDateTime
  };
  console.log("Data to store:", data);

  // Use chrome.runtime.sendMessage to access chrome.storage from popup
  chrome.runtime.sendMessage({
    action: "storeData",
    key: `instagram_stats_${username}`,
    data: data
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message);
  
  if (message.action === "showCompareResults") {
    console.log("Showing comparison results");
    
    // Hide user list
    document.getElementById("userList").style.display = "none";
    
    // Show comparison results
    const resultsDiv = document.getElementById("compareResults");
    resultsDiv.innerHTML = message.data;
    resultsDiv.style.display = "block";
    
    // Keep back button visible
    document.getElementById("backButton").style.display = "block";
  }
  
  // CRITICAL FIX: Handle storage operations here in the popup context
  else if (message.action === "storeData") {
    console.log("Storing data:", message.data);
    const storageKey = message.key;
    
    // Get existing data
    chrome.storage.local.get([storageKey], (result) => {
      let dataArray = [];
      
      if (result[storageKey]) {
        try {
          dataArray = JSON.parse(result[storageKey]);
          if (!Array.isArray(dataArray)) {
            dataArray = [dataArray];
          }
          
          // Check for duplicates
          if (dataArray.length > 0) {
            const lastEntry = dataArray[dataArray.length - 1];
            if (lastEntry.followerCount === message.data.followerCount && 
                lastEntry.followingCount === message.data.followingCount) {
              console.log("Skipping duplicate data");
              alert(`Stats for ${message.data.username} are unchanged since last check.\nFollowers: ${message.data.followerCount}\nFollowing: ${message.data.followingCount}`);
              return;
            }
          }
        } catch (e) {
          console.error("Error parsing stored data:", e);
          dataArray = [];
        }
      }
      
      // Add new data
      dataArray.push(message.data);
      
      // Store updated array
      chrome.storage.local.set({[storageKey]: JSON.stringify(dataArray)}, () => {
        console.log("Data stored successfully");
        alert(`Stored stats for ${message.data.username}:\nDate: ${message.data.timestamp}\nFollowers: ${message.data.followerCount}\nFollowing: ${message.data.followingCount}`);
      });
    });
  }
  else if (message.action === "getStoredData") {
    console.log("Getting stored data for comparison");
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
          console.error("Error parsing stored data:", e);
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
          console.log("Initial data stored successfully");
          
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
          resultsDiv.style.display = "block";
          document.getElementById("backButton").style.display = "block";
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
      
      // Helper function for formatting changes
      function getChangeClass(change) {
        if (change > 0) return "change-positive";
        if (change < 0) return "change-negative";
        return "change-neutral";
      }
      
      function formatChange(change) {
        if (change > 0) return "+" + change;
        return change.toString();
      }
      
      // Create result HTML
      const resultHTML = `
        <h3>Comparison for ${message.username}</h3>
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
      resultsDiv.innerHTML = resultHTML;
      document.getElementById("userList").style.display = "none";
      resultsDiv.style.display = "block";
      document.getElementById("backButton").style.display = "block";
    });
  }
});

// Debug Chrome storage when popup opens
console.log("Popup opened, debugging chrome.storage");
chrome.storage.local.get(null, (items) => {
  console.log("All chrome.storage.local items:", items);
  
  // Count Instagram stats entries
  let count = 0;
  for (const key in items) {
    if (key.startsWith("instagram_stats_")) {
      count++;
    }
  }
  console.log(`Found ${count} Instagram stats entries in chrome.storage.local`);
});