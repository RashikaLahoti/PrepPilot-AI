# 🚀 PrepPilot AI

PrepPilot AI is an **AI-powered interview preparation and job compatibility platform** built using the **MERN stack and Google Gemini API**.  
It analyzes a user's **Resume, Job Description (JD), and Self Description (SD)** to determine how well the candidate fits a job role.

The system generates a **job match score**, **technical interview questions**, **behavioral interview questions**, and a **personalized preparation roadmap** to help users prepare effectively for interviews.

It also allows users to **generate and download a job-optimized resume** using **Puppeteer**.

---

# ✨ Features

## 📊 AI Job Match Analysis
- Accepts **Resume, Job Description, and Self Description**
- Uses **Gemini API** to analyze the data
- Generates a **match score** showing job compatibility

## 🤖 AI Interview Question Generator
- Generates **Technical Interview Questions**
- Generates **Behavioral Interview Questions**
- Questions are tailored according to the **job description**

## 🗺 Personalized Preparation Roadmap
- Provides a **step-by-step preparation plan**
- Suggests **skills and topics to improve**
- Helps candidates become **job-ready**

## 📄 Smart Resume Generator
- Generates a **job-specific optimized resume**
- Formats resume automatically for the target job
- Uses **Puppeteer to generate downloadable PDF resumes**

## 📚 Strategy History
- Users can view **all previously generated strategies**
- Helps track interview preparation insights

---

# 🛠 Tech Stack

### Frontend
- React.js
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express.js

### Database
- MongoDB

### AI Integration
- Google Gemini API

### Automation
- Puppeteer (for generating downloadable PDF resumes)

---

# 🏗 System Workflow

1. User enters:
   - Resume
   - Job Description
   - Self Description

2. Backend sends the data to **Gemini API**

3. Gemini AI analyzes the input and generates:
   - Job match score
   - Technical interview questions
   - Behavioral interview questions
   - Preparation roadmap

4. Results are stored in **MongoDB**

5. User can generate a **job-optimized resume** and download it as **PDF using Puppeteer**

---

# ⚙️ Installation

## 1. Clone the repository

```bash
git clone https://github.com/RashikaLahoti/PrepPilot-AI.git
```

## 2. Navigate to the project

```bash
cd PrepPilot AI
```

## 3. Install backend dependencies

```bash
npm install
```

## 4. Install frontend dependencies

```bash
cd Frontend
npm install
```

## 5. Setup environment variables

Create a `.env` file in the backend folder and add:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
```

## 6. Run the project

Backend

```bash
npm start
```

Frontend

```bash
npm run dev
```

---

# 🎯 Future Improvements

- AI Mock Interview System
- ATS Resume Score Analyzer
- Job Recommendation Engine
- LinkedIn Profile Analysis
- Skill Gap Detection

---

# 👨‍💻 Author

**Rashika Lahoti**

Built using **MERN Stack + Generative AI** to help candidates **prepare smarter for job interviews**.

---

⭐ If you like this project, consider giving it a **star on GitHub**.
