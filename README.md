# RBAC System

A Role-Based Access Control (RBAC) system with a Node.js/Express/MongoDB backend and a React (Vite) frontend.

## Project Structure
- **/frontend**: React application using Vite. Includes authentication contexts, protected routes, and an analytics dashboard.
- **/backend**: Node.js REST API with Express. Implements secure JWT authentication, rate limiting, and MongoDB integration (Mongoose). Includes MongoDB Atlas Vector Search integration.

## Setup Instructions

### 1. Backend Setup
1. Navigate to the `backend` directory: `cd backend`
2. Install dependencies: `npm install`
3. Update `.env` with your MongoDB Atlas Connection String (`MONGO_URI`).
4. Start the development server: `npm run dev`

### 2. Frontend Setup
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the Vite development server: `npm run dev`

## Features
- **Secure Authentication**: JWT-based auth with bcrypt password hashing.
- **Protected Routes**: React router guards based on user roles.
- **Rate Limiting**: Protection against brute-force attacks on the backend.
- **MongoDB Atlas Integration**: Includes configuration for Vector Search.
- **Ready for Deployment**: Includes a `render.yaml` blueprint for one-click deployment to Render.
