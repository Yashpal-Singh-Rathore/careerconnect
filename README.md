# CareerConnect

CareerConnect is a full-stack web application designed for students and employers.

## Project Structure

```text
career_connect/
├── client/          # Frontend (React + Vite)
├── server/          # Backend (Node.js + Express)
├── database/        # Database setup and migrations
│   └── schema.sql
├── .gitignore
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MySQL](https://www.mysql.com/) server

---

## 1. Database Setup

1. Open your MySQL client / terminal:
   ```bash
   mysql -u root -p
   ```
2. Execute the initial SQL command:
   ```sql
   CREATE DATABASE IF NOT EXISTS career_connect;
   ```
   Or run the script file:
   ```bash
   mysql -u root -p < database/schema.sql
   ```

---

## 2. Backend Setup (`server`)

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `server/.env`:
   ```env
   PORT=5001
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=career_connect
   JWT_SECRET=career_connect_jwt_super_secret_key_2026
   CLIENT_URL=http://localhost:5173
   ```
4. Start the backend server:
   - For development (with auto-reload):
     ```bash
     npm run dev
     ```
   - For standard start:
     ```bash
     npm start
     ```

---

## 3. Frontend Setup (`client`)

1. Navigate to the client folder in a new terminal window:
   ```bash
   cd client
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Verify environment variables in `client/.env`:
   ```env
   VITE_API_URL=http://localhost:5001/api
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. Open your browser and visit: `http://localhost:5173`

---

## 4. Verification

### Verifying the Backend API Health

With the backend running, test the health check endpoint using `curl` or in your browser:

```bash
curl http://localhost:5001/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "CareerConnect API is running"
}
```
