# Pocket Militia

An original browser arena shooter with room-code multiplayer. The client is React + TypeScript + Canvas; a Node WebSocket server owns rooms, movement, firing cadence, ammo, hit detection, damage, eliminations and round state.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open <http://localhost:5173> in two browser tabs or devices on the same network (use the host's LAN address on the second device). The Vite development server proxies `/ws` to the game server on port 8080. Create a room in one tab, enter its four-character code in the other, then the room host starts the match when both players have joined.

Production build: `npm run build`. Local production game server: `npm start` (the WebSocket server listens on `PORT`, default 8080).

## Controls

- A/D or left/right arrows: move
- Space / W / up arrow: jump
- Hold Shift: jetpack
- Mouse: aim; click: fire
- R: reload when empty
- 1/2/3: sidearm, rifle, scattergun

On touch screens, use the left/right pads, JET, JUMP and FIRE. Landscape orientation gives the largest play area. Glowing pickups grant health, ammo, or a weapon.

## Deployment outline (Render + Vercel)

The frontend and WebSocket service need separate public deployments. The root `render.yaml` defines the Render Web Service and its `/healthz` check. To deploy, push this source to GitHub, create a Render Blueprint from the repository, then import the same repo into Vercel with build command `npm run build` and output directory `dist`. Set Vercel's `VITE_WS_URL` to the Render service hostname with `wss://` (for example `wss://pocket-militia-server.onrender.com`). Both providers need to be connected and authorized before deployment. Free hosting tiers may sleep between sessions and add reconnect latency.

The frontend contains no service secret. `VITE_WS_URL` is a public endpoint, not a credential.

## Current scope

Rooms are process-local and are removed when the last player leaves; arena bounds, ledges and floor are authoritative. Server-side combat is validated, while the browser renders snapshots. The game currently has one arena and a single three-minute round; the host can restart the same room for a rematch. A disconnected player can rejoin by room code (the client retries automatically), but rejoins as a new player without restoring their score. Cross-instance room storage is not implemented. For production scale, add a shared room store/pub-sub and a reconnect token before running multiple server instances.
