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

    // Safety timeout after 2 minutes to prevent infinite scrolling
    setTimeout(() => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        console.log(
          "Timeout reached after 2 minutes, downloading content collected so far"
        );
        downloadModalContent(
          followersModal,
          username,
          currentUser || "Unknown"
        );
      }
    }, 120000);

    return true;
  }

  // Function to download the modal content
  function downloadModalContent(modal, username, currentUser) {
    try {
      console.log("Preparing to download followers HTML");

      // Get the complete HTML content of the modal
      const modalHTML = modal.outerHTML;

      // Create a full HTML document with proper structure
      const fullHTML = document.querySelector(
        "div.xyi19xy.x1ccrb07.xtf3nb5.x1pc53ja.x1lliihq.x1iyjqo2.xs83m0k.xz65tgg.x1rife3k.x1n2onr6"
      ).innerHTML;

      // Create a Blob with the HTML content
      const blob = new Blob([fullHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      // Format filename with timestamp (replace colons and periods with hyphens for valid filename)

      // Create and click a download link
      const a = document.createElement("a");
      a.href = url;
      a.download = `${username}-followers.html`;
      a.click();

      // Clean up
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
