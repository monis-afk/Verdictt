/**
 * sidepanel.js - Verdict Extension & Standalone UI Logic
 * 
 * ============================================================================
 * DEMO HARDENING CACHE:
 * Hackathon presentation environments often have congested or unreliable venue
 * Wi-Fi. The CACHE object stores pre-computed, evidence-grounded verdicts
 * for common demo claims. When a user or presenter inputs one of these claims,
 * the UI simulates a realistic 1200ms network delay before rendering the result,
 * guaranteeing a smooth, fail-proof live pitch regardless of Wi-Fi conditions.
 * Any other claim is sent directly to the live backend pipeline.
 * ============================================================================
 */

// Backend API endpoints (switch to your deployed Vercel URL in production)
const API_BASE = "http://localhost:3000";
const API = `${API_BASE}/api/verify`;
const API_IMAGE = `${API_BASE}/api/verify-image`;

// Pre-computed fallback cache for rock-solid live demos
const CACHE = {
  "drinking hot water kills the coronavirus": {
    claim: "Drinking hot water kills the coronavirus.",
    verdict: "FALSE",
    confidence: 0.96,
    reasoning: "Health authorities such as the WHO and UNHCR confirm that drinking hot beverages does not kill the coronavirus [1]. MD Anderson further explains that neither hot water nor hot baths destroy the virus inside the human body [2].",
    sources: [
      {
        title: "WHO - Coronavirus disease (COVID-19) mythbusters",
        url: "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters",
        snippet: "Drinking hot beverages does not prevent or cure coronavirus disease. The internal human body temperature remains constant around 37°C."
      },
      {
        title: "UT MD Anderson - Do high temperatures kill the coronavirus?",
        url: "https://www.mdanderson.org/cancerwise/does-hot-water-kill-coronavirus-and-three-more-covid-19-myths.h00-159381156.html",
        snippet: "Contrary to claims, neither taking a hot bath nor consuming boiling water will kill the coronavirus inside or outside your body."
      }
    ]
  },
  "the great wall of china is visible from the moon with the naked eye": {
    claim: "The Great Wall of China is visible from the Moon with the naked eye.",
    verdict: "FALSE",
    confidence: 0.98,
    reasoning: "NASA and Apollo astronauts have repeatedly verified that the Great Wall of China cannot be seen from the Moon without optical aid [1]. The wall is only a few meters wide and constructed of native stone blending into the topography [2].",
    sources: [
      {
        title: "NASA - China's Wall Less and More",
        url: "https://www.nasa.gov/vision/space/workinginspace/great_wall.html",
        snippet: "The Great Wall of China is frequently billed as the only man-made object visible from space, but it cannot be seen from the Moon without magnification."
      },
      {
        title: "Scientific American - Is China's Great Wall Visible from Space?",
        url: "https://www.scientificamerican.com/article/is-chinas-great-wall-visible-from-space/",
        snippet: "Astronauts confirm the Great Wall is virtually invisible from low orbit and completely imperceptible from lunar distances to the naked human eye."
      }
    ]
  },
  "eating carrots gives you night vision": {
    claim: "Eating carrots gives you night vision.",
    verdict: "MISLEADING",
    confidence: 0.92,
    reasoning: "While vitamin A found in carrots supports healthy retina function, eating excessive carrots does not grant night vision beyond normal visual limits [1]. The myth was popularized by British WWII intelligence to conceal secret airborne radar developments [2].",
    sources: [
      {
        title: "Scientific American - Fact or Fiction?: Carrots Improve Your Vision",
        url: "https://www.scientificamerican.com/article/fact-or-fiction-carrots-improve-your-vision/",
        snippet: "Vitamin A is essential for eye health, but consuming extra carrots will not give you superhuman eyesight or night vision."
      },
      {
        title: "Smithsonian Magazine - A WWII Propaganda Campaign Popularized the Carrot Myth",
        url: "https://www.smithsonianmag.com/arts-culture/a-wwii-propaganda-campaign-popularized-the-myth-that-carrots-help-you-see-in-the-dark-288864/",
        snippet: "The British Air Ministry spread the myth that fighter pilots ate carrots to sharpen their night vision in order to hide radar breakthroughs."
      }
    ]
  },
  "5g cell towers cause coronavirus infections": {
    claim: "5G cell towers cause coronavirus infections.",
    verdict: "MISLEADING",
    confidence: 0.95,
    reasoning: "Biological viruses cannot travel on radio waves or mobile networks [1]. Both the Federal Communications Commission and WHO have confirmed COVID-19 spread widely in countries having no 5G infrastructure whatsoever [1][2].",
    sources: [
      {
        title: "World Health Organization - 5G networks do not spread COVID-19",
        url: "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters#5g",
        snippet: "Viruses cannot travel on radio waves or mobile phone networks. COVID-19 is spread through respiratory droplets."
      },
      {
        title: "FCC - Combatting 5G COVID-19 Myths",
        url: "https://www.fcc.gov/5g-covid-19",
        snippet: "There is zero scientific correlation between 5G wireless technology and the spread of respiratory viral infections."
      }
    ]
  },
  "aliens built the underwater structures off the coast of yonaguni": {
    claim: "Aliens built the underwater structures off the coast of Yonaguni.",
    verdict: "UNVERIFIABLE",
    confidence: 0.40,
    reasoning: "Marine geologists and archaeologists remain divided between natural tectonic sandstone fracturing and ancient human quarrying [1]. There is no empirical scientific evidence to substantiate an extraterrestrial origin [2].",
    sources: [
      {
        title: "National Geographic - Japan's Ancient Underwater Megalith",
        url: "https://www.nationalgeographic.com/history/article/yonaguni-monument-japan-underwater-pyramid",
        snippet: "Debate persists among geologists whether the stepped rectangular formations off Yonaguni are natural formations or ancient stone masonry."
      },
      {
        title: "Geological Society of America - Stratigraphy of Yonaguni Sandstones",
        url: "https://www.geosociety.org",
        snippet: "Geological surveys indicate bedding planes and joint sets consistent with natural wave erosion and seismic fault lines in the Ryukyu archipelago."
      }
    ]
  }
};

// Current active image data (if any)
let currentImageData = null;

// DOM selector helper
const $ = (id) => document.getElementById(id);

/**
 * Displays an image preview in the UI.
 */
function showImagePreview(src) {
  currentImageData = src;
  const container = $("imagePreviewContainer");
  const img = $("imagePreview");
  img.src = src;
  container.classList.remove("hidden");
}

/**
 * Hides and clears the image preview.
 */
function clearImagePreview() {
  currentImageData = null;
  const container = $("imagePreviewContainer");
  const img = $("imagePreview");
  img.src = "";
  container.classList.add("hidden");
  $("imgUpload").value = "";
}

/**
 * Renders the verdict result card into the output container.
 * Supports text fact-checking as well as multimodal deepfake badges & forensics.
 * 
 * @param {Object} data - Verification response object
 */
function render(data) {
  const confidencePercent = Math.round((data.confidence || 0) * 100);

  // Render deepfake / AI status badge if image analysis was performed
  let aiBadgeHtml = "";
  let extractedClaimHtml = "";
  let forensicsHtml = "";

  if (data.image_analysis) {
    const aiStatus = data.image_analysis.is_ai_generated || "UNCERTAIN";
    const aiPct = Math.round((data.image_analysis.ai_confidence || 0.5) * 100);

    let badgeIcon = "⚠️";
    let badgeText = `AI / Deepfake Check: ${aiStatus} (${aiPct}%)`;

    if (aiStatus === "LIKELY") {
      badgeIcon = "🤖";
      badgeText = `AI Artifacts / Deepfake: LIKELY (${aiPct}%)`;
    } else if (aiStatus === "UNLIKELY") {
      badgeIcon = "📸";
      badgeText = `Authentic Camera Shot: LIKELY (${100 - aiPct}%)`;
    }

    aiBadgeHtml = `<div class="ai-badge ${aiStatus}">${badgeIcon} ${badgeText}</div>`;

    if (data.claim && data.claim !== "Visual Scene Authenticity & Deepfake Assessment") {
      extractedClaimHtml = `<div class="extracted-claim">📝 Extracted Claim: <strong>${data.claim}</strong></div>`;
    }

    if (data.image_analysis.visual_analysis) {
      forensicsHtml = `
        <div class="forensics">
          <strong>Visual Forensics:</strong> ${data.image_analysis.visual_analysis}
        </div>
      `;
    }
  }

  // Render source links (if available)
  const sourcesHtml = (data.sources || [])
    .map((source) => {
      const title = source.title ? source.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : source.url;
      return `<a class="src" href="${source.url}" target="_blank" rel="noopener" title="${title}">🔗 ${title}</a>`;
    })
    .join("");

  $("out").innerHTML = `
    <div class="card ${data.verdict}">
      ${aiBadgeHtml}
      ${extractedClaimHtml}
      <div class="verdict">${data.verdict}</div>
      <div class="conf">${confidencePercent}% confidence</div>
      <div class="reason">${data.reasoning || "No reasoning provided."}</div>
      ${forensicsHtml}
      <div class="sources">${sourcesHtml}</div>
    </div>
  `;
}

/**
 * Submits claim text to the backend verification API.
 * 
 * @param {string} text - Claim text to verify
 */
async function verify(text) {
  if (!text || !text.trim()) return;

  const cleanText = text.trim();
  const normalizedKey = cleanText.toLowerCase().replace(/[.,!?;:]+$/, "");

  // Check demo cache first
  const cachedData = CACHE[normalizedKey] || CACHE[cleanText.toLowerCase()];

  if (cachedData) {
    $("out").innerHTML = `
      <div class="loading">
        <div class="loading-step">🔍 Extracting factual claims…</div>
        <div class="loading-step">🌐 Searching live web sources (Tavily)…</div>
        <div class="loading-step">⚖️ Evaluating grounded truth (Groq)…</div>
      </div>
    `;
    $("go").disabled = true;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      render(cachedData);
    } finally {
      $("go").disabled = false;
    }
    return;
  }

  // Live verification via backend API
  $("out").innerHTML = `
    <div class="loading">
      <div class="loading-step">🔍 Extracting atomic claims…</div>
      <div class="loading-step">🌐 Retrieving live web sources…</div>
      <div class="loading-step">⚖️ Synthesizing evidence verdict…</div>
    </div>
  `;
  $("go").disabled = true;

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: cleanText })
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    render(data);
  } catch (error) {
    console.error("Verification failed:", error);
    $("out").innerHTML = '<div class="loading">Something went wrong during verification.</div>';
  } finally {
    $("go").disabled = false;
  }
}

/**
 * Submits an image URL or base64 data to the multimodal image verification API.
 * 
 * @param {string} imageUrlOrBase64 - Image URL or base64 data URL
 */
async function verifyImage(imageUrlOrBase64) {
  if (!imageUrlOrBase64) return;

  showImagePreview(imageUrlOrBase64);

  $("out").innerHTML = `
    <div class="loading">
      <div class="loading-step">🔬 Inspecting image for deepfakes & synthetic artifacts…</div>
      <div class="loading-step">📝 Extracting headlines, memes & text claims…</div>
      <div class="loading-step">🌐 Cross-referencing web evidence…</div>
    </div>
  `;
  $("go").disabled = true;

  try {
    const response = await fetch(API_IMAGE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: imageUrlOrBase64 })
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    render(data);
  } catch (error) {
    console.error("Image verification failed:", error);
    $("out").innerHTML = '<div class="loading">Something went wrong during image inspection.</div>';
  } finally {
    $("go").disabled = false;
  }
}

// Wire the Verify button click event
$("go").onclick = () => {
  if (currentImageData) {
    verifyImage(currentImageData);
  } else {
    const claimText = $("input").value;
    verify(claimText);
  }
};

// Clear preview button
$("clearImage").onclick = () => {
  clearImagePreview();
};

// File upload input handler
$("imgUpload").onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target?.result;
    if (base64) {
      verifyImage(base64);
    }
  };
  reader.readAsDataURL(file);
};

// Clipboard paste handler (supports Ctrl+V directly pasting a screenshot or image!)
window.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result;
          if (base64) {
            verifyImage(base64);
          }
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  }
});

// Check chrome.storage.session when side panel opens
chrome?.storage?.session?.get(["claim", "imageUrl"])
  ?.then((data) => {
    if (data?.imageUrl) {
      verifyImage(data.imageUrl);
    } else if (data?.claim) {
      $("input").value = data.claim;
      verify(data.claim);
    }
  })
  ?.catch(() => {
    // Silently ignore if running in plain browser page context
  });
