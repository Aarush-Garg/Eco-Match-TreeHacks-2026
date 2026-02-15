# 🌍 Climate-Tech AI Chatbot

A specialized chatbot powered by Google Gemini API that provides expert knowledge on climate technologies, decarbonization strategies, and clean energy solutions. The chatbot is tailored to climate-tech domains using data from [climatetechmap.com](https://climatetechmap.com).

## Features

- **🤖 AI-Powered**: Uses Google Gemini Pro (free tier) for intelligent responses
- **📚 Climate-Tech Expertise**: Specialized knowledge across 6 key sectors:
  - Buildings (heat pumps, smart buildings, sustainable materials)
  - Manufacturing (green hydrogen, industrial electrification)
  - Transportation (EVs, hydrogen fuel cells, sustainable aviation)
  - Food, Agriculture & Nature (methane reduction, regenerative farming)
  - Electricity (renewables, energy storage, grid modernization)
  - GHG Removal (direct air capture, carbon sequestration)
- **🔍 Smart Context Retrieval (RAG)**: Automatically injects relevant climate-tech context based on your queries
- **🎯 Keyword Filtering**: Detects and emphasizes climate-tech topics in conversations
- **💬 Interactive UI**: Clean, responsive chat interface with typing indicators and suggestions

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **AI**: Google Gemini API
- **Data**: JSON-based knowledge base with comprehensive climate-tech taxonomy

## Prerequisites

- Node.js 18.x or higher
- A free Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

## Installation

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Get your free Gemini API key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy your API key

4. **Configure environment variables**
   - Open the `.env` file
   - Replace `your_api_key_here` with your actual Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   PORT=3000
   ```

## Usage

1. **Start the server**
   ```bash
   npm start
   ```

   You should see:
   ```
   🌍 Climate-Tech Chatbot server running on http://localhost:3000
   📚 Loaded 6 climate-tech sectors
   🔑 API Key configured: Yes
   ```

2. **Open your browser**
   - Navigate to [http://localhost:3000](http://localhost:3000)

3. **Start chatting!**
   - Try asking about:
     - "What are heat pumps and how do they work?"
     - "How can we decarbonize transportation?"
     - "Tell me about direct air capture"
     - "What are climate-tech moonshots?"

## Project Structure

```
.
├── index.html              # Main chat interface
├── styles.css              # UI styling (climate-themed)
├── app.js                  # Frontend JavaScript
├── server.js               # Express backend + Gemini integration
├── climate-knowledge.json  # Climate-tech taxonomy database
├── package.json            # Node dependencies
├── .env                    # Environment variables (API key)
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## How It Works

### 1. System Prompt Configuration
The chatbot is configured with a specialized system prompt that establishes it as a climate-tech expert with knowledge across all 6 sectors.

### 2. Keyword Extraction
When you send a message, the backend analyzes your query to extract climate-tech keywords (e.g., "heat pumps", "carbon capture", "solar", etc.).

### 3. Context Retrieval (RAG)
Based on extracted keywords, the system retrieves relevant information from the climate knowledge base:
- Sector descriptions
- Key technologies
- Innovation imperatives
- Moonshot projects

### 4. Enhanced Prompt
The retrieved context is injected into the prompt sent to Gemini, ensuring responses are grounded in climate-tech knowledge.

### 5. Intelligent Response
Gemini generates a comprehensive response using both its base knowledge and the injected climate-tech context.

## Example Queries

- "What are the main technologies for decarbonizing buildings?"
- "How does green hydrogen work and where can it be used?"
- "What's the difference between DAC and BECCS?"
- "Tell me about regenerative agriculture"
- "What are the challenges with electric vehicles?"
- "How can we reduce methane emissions from livestock?"
- "What innovations are needed for sustainable aviation?"
- "Explain grid-scale battery storage"

## API Endpoints

### `POST /api/chat`
Send a message to the chatbot.

**Request:**
```json
{
  "message": "What are heat pumps?"
}
```

**Response:**
```json
{
  "response": "Heat pumps are...",
  "metadata": {
    "keywords": ["heat_pumps", "buildings"],
    "sectorsReferenced": ["Buildings"]
  }
}
```

### `GET /api/health`
Check server health status.

**Response:**
```json
{
  "status": "ok",
  "message": "Climate-Tech Chatbot API is running",
  "sectorsLoaded": 6
}
```

## Troubleshooting

### "Invalid API key" error
- Make sure you've added your Gemini API key to the `.env` file
- Verify the key is correct (no extra spaces or quotes)
- Ensure you've created the API key at [Google AI Studio](https://aistudio.google.com/app/apikey)

### "API quota exceeded" error
- The free Gemini API has rate limits
- Wait a few minutes and try again
- Consider upgrading to a paid plan if needed

### Server won't start
- Make sure Node.js 18+ is installed: `node --version`
- Delete `node_modules` and run `npm install` again
- Check if port 3000 is available (or change PORT in `.env`)

### Chat not responding
- Check browser console for errors (F12 → Console)
- Verify the server is running: visit [http://localhost:3000/api/health](http://localhost:3000/api/health)
- Check server terminal for error messages

## Customization

### Adding More Climate Data
Edit `climate-knowledge.json` to add:
- New sectors
- Additional technologies
- More keywords for better matching
- Custom imperatives or moonshots

### Changing the AI Model
In `server.js`, line 17:
```javascript
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
```
You can change to other Gemini models if needed.

### Styling
Edit `styles.css` to customize:
- Colors and theme
- Layout and spacing
- Responsive breakpoints

## Credits

- **Climate Data**: [Climate Tech Map](https://climatetechmap.com) by Breakthrough Energy, Stanford, and McKinsey
- **AI**: Google Gemini API
- **Built for**: TreeHacks V2

## License

ISC

## Support

For issues or questions, please check:
1. This README
2. Server console logs
3. Browser console (F12)

---

**Made with 🌱 for a sustainable future**
