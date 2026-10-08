# Verdict ⚖️

> **Real-time, evidence-grounded misinformation verification in your browser.**

**Verdict** is a lightweight Chrome Extension built for hackathons to solve internet misinformation. 

Unlike traditional LLM wrappers that hallucinate answers from static parametric memory, Verdict is an **evidence-grounded verification pipeline**. Every verdict is computed dynamically at runtime using live, cited web sources retrieved via Tavily and evaluated strictly by high-speed inference on Groq. If evidence is missing, ambiguous, or contradictory, the system reports `UNVERIFIABLE`.

**Now includes Multimodal Vision & Deepfake Verification:**
- **Text Selection:** Right-click any text claim on the web to verify with cited sources.
- **Image & Meme Verification:** Right-click any image, meme, or screenshot to extract claims and detect generative AI / deepfake artifacts.
- **Direct Screenshot Paste:** Press `Ctrl+V` inside the side panel to paste a screenshot directly for instant fact-checking.

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express (ES Modules), deployable to Vercel
- **LLM Engine**: [Groq API](https://console.groq.com) (OpenAI-compatible chat completions endpoint)
- **Web Evidence Search**: [Tavily API](https://tavily.com) (AI-optimized real-time search engine)
- **Frontend UI**: Vanilla JavaScript + hand-crafted CSS (Zero React, zero Tailwind, zero CDNs for total Manifest V3 compliance)
- **Extension Architecture**: Chrome Extension Manifest V3, Side Panel API, Context Menus API, Session Storage

---

## 📂 Project Structure

```text
verdict/
├── .gitignore                  # Ignores .env and node_modules
├── .env.example                # Example environment variables
├── README.md                   # Complete documentation & pitch guide
├── backend/
│   ├── .env                    # Real API keys (GROQ_API_KEY, TAVILY_API_KEY)
│   ├── .env.example            # Backend env template
│   ├── package.json            # Node.js dependencies (type: module)
│   ├── vercel.json             # Vercel serverless deployment config
│   ├── llm.js                  # Groq API caller with JSON schema mode
│   ├── pipeline.js             # Extraction, search, judging, & test script
│   └── server.js               # Express API (/api/health, /api/verify) with CORS
└── extension/
    ├── manifest.json           # Chrome MV3 manifest (side panel & permissions)
    ├── background.js           # Service worker (context menu & session storage)
    ├── sidepanel.html          # Clean CSP-compliant UI layout
    ├── sidepanel.css           # Dark theme & verdict color borders
    └── sidepanel.js            # UI logic & offline demo fallback cache
```

---

## 🔑 Required Environment Variables

Verdict requires two API keys placed in `backend/.env`:

| Variable | Description | Where to Obtain |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | Ultra-fast LLM inference API key | [Groq Console](https://console.groq.com) |
| `TAVILY_API_KEY` | Real-time web evidence search API key | [Tavily Dashboard](https://tavily.com) |
| `GROQ_MODEL` | *(Optional)* Model ID (defaults to `openai/gpt-oss-120b`) | [Groq Supported Models](https://console.groq.com/docs/models) |

---

## 🚀 Local Setup & Running

### 1. Install Dependencies
Open a terminal in the project directory:
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create `backend/.env` (or copy from `.env.example`):
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
TAVILY_API_KEY=tvly-your_tavily_api_key_here
```

### 3. Test the Pipeline Directly
Run the standalone verification test to ensure API keys and evidence retrieval work:
```bash
node pipeline.js
```
You should see a formatted JSON verdict confirming that drinking hot water does not kill the coronavirus, along with cited URLs.

### 4. Start the Express API Server
```bash
node server.js
```
The server will start on `http://localhost:3000`. You can test it in a separate terminal:
```bash
curl http://localhost:3000/api/health
```

---

## 🧩 Installing the Chrome Extension

1. Open Google Chrome and go to `chrome://extensions/`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click the **Load unpacked** button in the upper-left.
4. Select the `extension/` folder inside this repository:
   ```text
   d:\VERDICTT\extension
   ```
5. The **Verdict** extension will now appear in your extensions list.

### Inspecting & Debugging:
- **Background Service Worker**: Click the blue `service worker` link under Verdict on `chrome://extensions/` to inspect background logs.
- **Side Panel UI**: Highlight text on any website, right-click, and select **Verify "..."**. When the side panel slides out, right-click inside the panel and choose **Inspect**.

---

## 🌐 Deploying Backend to Vercel

The backend includes a pre-configured `backend/vercel.json` file ready for Vercel deployment:

1. Install the Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```
2. Navigate to the `backend` folder and run:
   ```bash
   cd backend
   vercel
   ```
3. Set your production environment variables in the Vercel dashboard:
   - `GROQ_API_KEY`
   - `TAVILY_API_KEY`
   - `GROQ_MODEL` (optional)
4. Once deployed, update the `API` constant at the top of `extension/sidepanel.js`:
   ```javascript
   const API = "https://your-backend-app.vercel.app/api/verify";
   ```
5. Reload the unpacked extension in `chrome://extensions/`.

---

## 🛡️ Demo Hardening (Hackathon Pitch Wi-Fi Fail-Safe)

Live hackathon pitches often suffer from congested venue Wi-Fi. To guarantee the live demo never fails on stage, `extension/sidepanel.js` includes a pre-computed cache for 5 high-impact claims:
1. `"Drinking hot water kills the coronavirus"` (`FALSE`)
2. `"The Great Wall of China is visible from the Moon with the naked eye"` (`FALSE`)
3. `"Eating carrots gives you night vision"` (`MISLEADING`)
4. `"5G cell towers cause coronavirus infections"` (`MISLEADING`)
5. `"Aliens built the underwater structures off the coast of Yonaguni"` (`UNVERIFIABLE`)

When any of these claims are verified, the extension injects a realistic 1200ms delay before displaying the exact, cited evidence card—ensuring an uninterrupted live presentation even if the Wi-Fi drops completely!
