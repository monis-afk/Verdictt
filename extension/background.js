/**
 * background.js - Chrome Extension Service Worker
 * 
 * Handles context menu registration for both text selections and images,
 * passes state via chrome.storage.session, and opens the Verdict side panel.
 */

// Register context menus for text selection and images
chrome.runtime.onInstalled.addListener(() => {
  // 1. Text Selection Context Menu
  chrome.contextMenus.create({
    id: "verify",
    title: 'Verify "%s"',
    contexts: ["selection"]
  });

  // 2. Image / Deepfake Context Menu
  chrome.contextMenus.create({
    id: "verify-image",
    title: "Verify Image & Deepfake",
    contexts: ["image"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "verify" && info.selectionText) {
    // Clear any previous image and store text claim
    await chrome.storage.session.set({ claim: info.selectionText, imageUrl: null });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } else if (info.menuItemId === "verify-image" && info.srcUrl) {
    // Clear any previous text claim and store image URL
    await chrome.storage.session.set({ imageUrl: info.srcUrl, claim: null });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  }
});

// Handle toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});
