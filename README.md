# Developer Growth Intelligence Platform

A MERN stack application that analyzes a developer's GitHub repositories, identifies their technical skills, compares them with a selected job role, identifies skill gaps, and recommends improvements.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 19 + Vite                   |
| Backend   | Node.js + Express                 |
| Database  | MongoDB + Mongoose                |
| Auth      | JWT (JSON Web Tokens)             |
| Data      | GitHub REST API (free, no key required for public repos) |

---

## Project Structure

```
developer-growth-platform/
├── client/          # React + Vite frontend
└── server/          # Express + MongoDB backend
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local installation or MongoDB Atlas free tier)

### 1. Install client dependencies
```bash
cd client
npm install
```

### 2. Install server dependencies
```bash
cd server
npm install
```

### 3. Configure environment variables
Copy and edit the root `.env` file:
```
MONGODB_URI=mongodb://127.0.0.1:27017/developer_growth_platform
JWT_SECRET=your_long_random_secret
GITHUB_TOKEN=your_github_token_here   # optional, increases rate limit
PORT=5000
```

### 4. Run the frontend (development)
```bash
cd client
npm run dev
```
Open http://localhost:5173 in your browser.

### 5. Run the backend (development)
```bash
cd server
npm run dev
```
Health check: http://localhost:5000/api/health

---

## Current Status (Step 1 — Foundation)
- [x] Project structure created
- [x] React + Vite frontend scaffolded and running
- [x] All backend folders and placeholder files created
- [x] MongoDB schemas defined
- [x] API routes and controllers stubbed
- [ ] Business logic (Step 2+)
- [ ] Authentication (Step 2)
- [ ] GitHub API integration (Step 3)
- [ ] Skill analysis engine (Step 4)
