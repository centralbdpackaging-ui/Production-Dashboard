# Production Dashboard 2026 - Hourly Cutting

This is a premium, high-performance production dashboard designed for 24/7 monitoring of hourly cutting machines.

## Features
- **Premium Aesthetics**: Glassmorphism design with smooth transitions and vibrant gradients.
- **Auto-Rotation**: Slides rotate every 10 seconds to show different sections (Summary, Side Seal, Zip Lock, Bottom).
- **Responsive Layout**: Designed for large monitoring screens.
- **Local Server Ready**: Comes with a pre-configured local server for easy preview.

## How to Run Locally

### Option 1: Using the provided Local Server (Recommended)
1. Open your terminal in this directory.
2. Run the following command:
   ```bash
   npm start
   ```
3. Open your browser and go to: `http://localhost:3000` (or the port shown in the terminal).

### Option 2: Direct Open
Simply double-click `index.html` in your file explorer.

## Project Structure
- `index.html`: Main structure and SEO-optimized markup.
- `styles.css`: Premium styling with glassmorphism and animations.
- `app.js`: Data rendering logic and slide management.
- `package.json`: Local server configuration.

## Data Source
The dashboard currently uses mock data defined in `app.js`. To connect to a live data source (e.g., Google Sheets or an API), update the `MOCK_DATA` object in `app.js` with a fetch call.
