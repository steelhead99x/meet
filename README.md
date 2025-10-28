# 🎵 Artist-Space Meet

A modern video conferencing application built with LiveKit, Next.js, and React. Features end-to-end encryption, virtual backgrounds, and real-time communication.

## ✨ Features

- 🎥 HD video conferencing with screen sharing
- 🔒 End-to-end encryption (E2EE)
- 🎨 Virtual backgrounds (blur, gradients, images)
- 💬 Real-time chat
- 🎙️ Advanced audio/video controls
- 📱 Responsive design
- ⚡ Optimized performance

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** (recommended) or npm
- **LiveKit account** - Get one free at [LiveKit Cloud](https://cloud.livekit.io/)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd meet
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```
   Or with npm:
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the project root:
   ```bash
   touch .env.local
   ```
   
   Add the following variables (get these from your [LiveKit Cloud dashboard](https://cloud.livekit.io/)):
   ```env
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```
   
   Open [http://localhost:3000/meet](http://localhost:3000/meet) in your browser.

   ⚠️ **Important**: The app runs on `/meet` path, not root!

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server at http://localhost:3000/meet |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint errors |
| `pnpm test` | Run tests |
| `pnpm format:check` | Check code formatting |
| `pnpm format:write` | Auto-format code |

## 🔧 Configuration

### Base Path

This application is configured to run on the `/meet` base path. This is set in `next.config.js`:

```javascript
basePath: '/meet',
assetPrefix: '/meet',
```

**What this means:**
- Development: Access at `http://localhost:3000/meet`
- Production: Deploy to `https://yourdomain.com/meet`
- All routes are prefixed with `/meet`
- All assets are served from `/meet/_next/...`

**Important for API Routes:**
The application automatically handles the base path for API routes. The connection details endpoint is configured as `/meet/api/connection-details`. If you're deploying behind a reverse proxy, ensure the proxy forwards requests to `/meet` correctly.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIVEKIT_URL` | ✅ Yes | Your LiveKit server URL (wss://...) |
| `LIVEKIT_API_KEY` | ✅ Yes | Your LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ Yes | Your LiveKit API secret |
| `NEXT_PUBLIC_SHOW_SETTINGS_MENU` | ❌ No | Show advanced settings menu (default: false) |
| `NEXT_PUBLIC_CONN_DETAILS_ENDPOINT` | ❌ No | Custom connection details endpoint |

## 🏗️ Building for Production

1. **Build the application**
   ```bash
   pnpm build
   ```

2. **Start the production server**
   ```bash
   pnpm start
   ```

3. **Access the application**
   
   Navigate to `http://localhost:3000/meet`

## 🌐 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

The app will be available at `https://your-domain.vercel.app/meet`

### Heroku

1. Set environment variables:
   ```bash
   heroku config:set LIVEKIT_URL=wss://your-project.livekit.cloud
   heroku config:set LIVEKIT_API_KEY=your-api-key
   heroku config:set LIVEKIT_API_SECRET=your-api-secret
   ```

2. Deploy:
   ```bash
   git push heroku main
   ```

The app will be available at `https://your-app.herokuapp.com/meet`

### Docker

1. Build the image:
   ```bash
   docker build -t artist-space-meet .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 \
     -e LIVEKIT_URL=wss://your-project.livekit.cloud \
     -e LIVEKIT_API_KEY=your-api-key \
     -e LIVEKIT_API_SECRET=your-api-secret \
     artist-space-meet
   ```

Access at `http://localhost:3000/meet`

## 📁 Project Structure

```
meet/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   │   ├── connection-details/  # LiveKit token generation
│   │   └── record/         # Recording endpoints
│   ├── rooms/              # Room pages
│   │   └── [roomName]/     # Dynamic room route
│   ├── custom/             # Custom connection page
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── lib/                     # Shared utilities and components
│   ├── CameraSettings.tsx  # Camera controls & backgrounds
│   ├── MicrophoneSettings.tsx
│   ├── SettingsMenu.tsx
│   ├── KeyboardShortcuts.tsx
│   └── types.ts
├── styles/                  # CSS modules and global styles
├── public/                  # Static assets
│   └── background-images/  # Virtual background images
├── next.config.js          # Next.js configuration
└── package.json
```

## 🎮 Usage

### Starting a Meeting

1. Navigate to `http://localhost:3000/meet`
2. (Optional) Enable end-to-end encryption
3. Click "Start Meeting"
4. Enter your name and configure audio/video
5. Click "Join Room"
6. Share the room URL with others!

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `m` | Toggle microphone |
| `v` | Toggle camera |
| `s` | Toggle screen share |
| `c` | Toggle chat |
| `?` | Show keyboard shortcuts |

### Virtual Backgrounds

1. Click the settings icon in the video conference
2. Select "Camera Settings"
3. Choose from:
   - **None**: No background effect
   - **Blur**: Blur your background
   - **Gradients**: Beautiful gradient backgrounds
   - **Images**: Custom background images

## 🔍 Troubleshooting

### App not loading at localhost:3000

The app runs on `/meet` path. Try: `http://localhost:3000/meet`

### Missing environment variables

Check your `.env.local` file has all required variables:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

### Camera/Microphone not working

1. Check browser permissions
2. Use HTTPS or localhost (required for WebRTC)
3. Ensure no other app is using the camera

### E2EE not working

End-to-end encryption requires:
- Modern browser (Chrome/Edge 91+, Safari 15.4+, Firefox 90+)
- SharedArrayBuffer support
- Secure context (HTTPS)

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/)
- **UI Library**: [React 18](https://react.dev/)
- **Video SDK**: [LiveKit](https://livekit.io/)
- **Components**: [@livekit/components-react](https://github.com/livekit/components-js/)
- **Styling**: CSS Modules
- **Language**: TypeScript
- **Package Manager**: pnpm

## 📝 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions:
- Check the [LiveKit documentation](https://docs.livekit.io/)
- Visit [LiveKit Community](https://livekit.io/community)
- Review existing GitHub issues

---

Built with ❤️ using [LiveKit](https://livekit.io/)
