# 🎵 SoundWave — Music Subscription Web App

A cloud-based music subscription application built with AWS services including DynamoDB, S3, EC2, ECS, and Lambda.

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- AWS CLI configured with credentials
- An AWS account with LabRole access

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your AWS credentials and settings
# Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, 
#           AWS_SESSION_TOKEN, S3_BUCKET_NAME, JWT_SECRET
```

### 3. Setup AWS Resources

```bash
# Create DynamoDB tables
npm run create-tables

# Load music data
npm run load-data

# Upload artist images to S3
npm run upload-images

# Seed test users
npm run seed-users
```

### 4. Run the Application

```bash
# Development mode (auto-restart)
npm run dev

# Or production mode
npm start
```

### 5. Open in Browser

Visit `http://localhost:3000`

**Test credentials:**
- Email: `tushar@example.com` / Password: `password123`
- Email: `admin@example.com` / Password: `admin123`

---

## 📁 Project Structure

```
music-subscription-app/
├── backend/           # Node.js + Express API
│   ├── src/           # Application source code
│   │   ├── config/    # AWS SDK configuration
│   │   ├── routes/    # API route handlers
│   │   ├── services/  # DynamoDB & S3 service layer
│   │   └── middleware/ # JWT authentication
│   ├── scripts/       # Setup & data loading scripts
│   ├── data/          # Song data (JSON)
│   └── server.js      # Entry point
├── frontend/          # Static HTML/CSS/JS frontend
│   ├── css/           # Styles
│   ├── js/            # Client-side JavaScript
│   └── index.html     # Main page
├── lambda/            # AWS Lambda functions
│   ├── auth/          # Authentication handler
│   ├── music/         # Music search handler
│   └── subscription/  # Subscription handler
├── docs/              # Architecture documentation
├── Dockerfile         # Docker config for ECS
└── README.md
```

## 🔧 Deployment Options

See [docs/architecture.md](docs/architecture.md) for detailed deployment guides:
- **EC2**: Node.js on Amazon Linux
- **ECS**: Docker container on Fargate
- **Lambda**: Serverless with API Gateway

## 📊 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Backend | Node.js, Express.js |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 (Pre-signed URLs) |
| Auth | JWT + bcrypt |
| Container | Docker |
| Compute | EC2 / ECS Fargate / Lambda |
