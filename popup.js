document.getElementById("downloadBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: downloadFollowersHTML,
    });
  });
});

function downloadFollowersHTML() {
  console.log("Script executing...");

  // Check if we're on Instagram
  if (!window.location.href.includes("instagram.com/")) {
    console.log("This script only works on Instagram pages");
    return;
  }

  // Extract username from URL
  const urlPath = window.location.pathname;
  const username = urlPath.split("/")[1];
  console.log("Detected username:", username);

  if (!username) {
    console.log("Could not detect Instagram username");
    return;
  }

  // Try to get logged-in user info
  let currentUser = "";
  try {
    // Attempt to find username element in Instagram UI
    const userElem = document.querySelector('a[href*="/"] span[dir="auto"]');
    if (userElem) {
      currentUser = userElem.textContent;
    }
  } catch (error) {
    console.log("Could not detect current user:", error);
  }
  console.log("Current User:", currentUser || "Unknown");

  // Function to handle modal dialog and scrolling
  function processFollowersModal() {
    console.log("Looking for followers modal...");

    // Using the exact class provided by the user for the modal
    const followersModal = document.querySelector(
      "div.xyi19xy.x1ccrb07.xtf3nb5.x1pc53ja.x1lliihq.x1iyjqo2.xs83m0k.xz65tgg.x1rife3k.x1n2onr6"
    );

    if (!followersModal) {
      console.log("Followers modal not found");
      return false;
    }
    console.log("Followers modal found");

    // DIRECTLY SCROLL INSIDE THE MODAL DIV itself as requested
    const scrollableElement = followersModal;

    if (!scrollableElement) {
      console.log("Scrollable element not found");
      return false;
    }
    console.log("Scrollable element found:", scrollableElement.className);

    // Start the scrolling process
    let lastHeight = 0;
    let unchangedCount = 0;

    console.log("Starting to scroll through followers...");
    const scrollInterval = setInterval(() => {
      // Scroll to bottom of the container
      scrollableElement.scrollTop = scrollableElement.scrollHeight;

      // Log current scroll position and height
      console.log(
        "Scrolling... Height:",
        scrollableElement.scrollHeight,
        "Position:",
        scrollableElement.scrollTop,
        "Unchanged count:",
        unchangedCount
      );

      // Check if we've reached the bottom (no more content loading)
      if (lastHeight === scrollableElement.scrollHeight) {
        unchangedCount++;

        // If the height remains unchanged for 5 consecutive checks, we've reached the end
        if (unchangedCount >= 5) {
          clearInterval(scrollInterval);
          console.log(
            "Reached bottom of followers list, preparing to download"
          );

          // Download the modal content
          downloadModalContent(
            followersModal,
            username,
            currentUser || "Unknown"
          );
        }
      } else {
        // Content still loading, reset counter
        unchangedCount = 0;
        lastHeight = scrollableElement.scrollHeight;
      }
    }, 1500); // Check every 1.5 seconds

    return true;
  }

  function downloadModalContent(modal, username, currentUser) {
    try {
      console.log("Preparing to download followers HTML");

      // Ensure modal exists
      if (!modal) {
        console.error("Modal element not found.");
        return;
      }

      // Select all follower links inside the modal
      const anchorElements = modal.querySelectorAll("a");

      // Extract usernames from <span> inside each <a>
      const usernames = [...anchorElements]
        .map((anchor) => {
          const span = anchor.querySelector(
            "span._ap3a._aaco._aacw._aacx._aad7._aade"
          );
          return span ? span.textContent.trim() : null;
        })
        .filter(Boolean); // Remove null values

      if (usernames.length === 0) {
        console.warn("No followers found in the modal.");
        return;
      }

      // Create a simple HTML document with extracted usernames
      const fullHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${username} Followers</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          ul { list-style: none; padding: 0; }
          li { margin: 5px 0; font-size: 18px; }
        </style>
      </head>
      <body>
        <h1>${username}'s Followers</h1>
        <ul>
          ${usernames.map((name) => `<li>${name}</li>`).join("")}
        </ul>
        <p>Followers Count: ${usernames.length}</p>
      </body>
      </html>
    `;

      // Create a Blob with the formatted HTML content
      const blob = new Blob([fullHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      // Generate a timestamped filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${username}-followers-${timestamp}.html`;

      // Create and trigger the download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the URL object
      URL.revokeObjectURL(url);
      console.log("Download complete!");
    } catch (error) {
      console.error("Error during download:", error);
    }
  }

  // Check if modal is already open
  if (document.querySelector("div.xyi19xy.x1ccrb07.xtf3nb5.x1pc53ja")) {
    console.log("Followers modal already open");
    processFollowersModal();
  } else {
    console.log("Looking for followers link to click");
    // Find and click the followers link
    const followersLink = document.querySelector(
      `a[href="/${username}/followers/"]`
    );

    if (!followersLink) {
      console.log("Followers link not found");
      return;
    }

    console.log("Clicking followers link");
    followersLink.click();

    // Wait for the modal to appear
    let checkAttempts = 0;
    const maxAttempts = 10;

    const modalCheckInterval = setInterval(() => {
      checkAttempts++;
      console.log(
        `Checking for modal (attempt ${checkAttempts}/${maxAttempts})...`
      );

      if (processFollowersModal()) {
        // Modal found and processing started
        clearInterval(modalCheckInterval);
      } else if (checkAttempts >= maxAttempts) {
        // Give up after max attempts
        clearInterval(modalCheckInterval);
        console.log("Failed to find followers modal after multiple attempts");
      }
    }, 1000); // Check every second
  }
}
