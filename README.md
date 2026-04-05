# CenTex Distraxion

Mobile-first swipe dating PWA for the Central Texas / Fort Cavazos area.

---

## File Structure

```
centex-distraxion/
├── frontend/
│   └── index.html          ← Full PWA (deploy to Netlify)
└── backend/
    ├── server.js            ← Express entry point
    ├── .env.example         ← Copy to .env and fill in values
    ├── package.json
    ├── middleware/
    │   └── auth.js          ← JWT verification
    ├── models/
    │   ├── User.js          ← User schema + swipe limit logic
    │   └── Match.js         ← Swipe + Match schemas
    └── routes/
        ├── auth.js          ← POST /signup /login /logout DELETE /delete
        ├── profiles.js      ← GET /feed PUT /me GET /:id
        └── matches.js       ← POST /swipe GET /mine
```

---

## Deploy — Step by Step

### 1. MongoDB Atlas (new cluster)
- Create Cluster1 at cloud.mongodb.com
- Database name: `centex_db`
- Create DB user, whitelist 0.0.0.0/0
- Copy connection string → paste into .env as MONGO_URI

### 2. Backend — Render.com
- New Web Service → connect GitHub repo
- Root directory: `backend`
- Build command: `npm install`
- Start command: `node server.js`
- Add environment variables from .env

### 3. Frontend — Netlify
- Drag and drop the `frontend/` folder
- OR connect GitHub repo, publish directory: `frontend`
- Update API_URL in index.html to your Render URL

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/signup | No | Create account |
| POST | /api/auth/login | No | Login |
| POST | /api/auth/logout | Yes | Logout |
| DELETE | /api/auth/delete | Yes | Delete profile |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/profiles/feed | Yes | Browse profiles |
| PUT | /api/profiles/me | Yes | Update my profile |
| GET | /api/profiles/:id | Yes | View a profile |
| POST | /api/matches/swipe | Yes | Swipe left or right |
| GET | /api/matches/mine | Yes | Get my matches |

---

## Swipe Limits

- Free: 10 swipes/day (resets midnight)
- Distraxion+: Unlimited ($9.99/mo)
- Boost: Top of feed 1hr ($2.99 one-time)

---

## Monetization Stack (Phase 1)

1. Stripe for Distraxion+ subscriptions and Boost one-time payments
2. Google AdSense on free tier browse screen
3. Dating affiliate banners (Match Group, etc.) for non-premium users
# distraxion
