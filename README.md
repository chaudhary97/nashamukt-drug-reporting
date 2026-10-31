# 🛡️ NashaMukt
### 🌱 Anonymous Drug Activity Reporting & Investigation Platform

<p align="center">
  <strong>Building a safer, drug-free society through technology.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" />
</p>

---

## 🌟 About the Project

**NashaMukt** is a web-based platform designed to help citizens anonymously report suspected drug-related activities and help authorities manage, investigate, and resolve reports efficiently.

It connects citizens, government administrators, and local officers through a centralized reporting and investigation system.

🎯 **Our Mission:** Use technology to encourage community participation, support responsible reporting, and help build safer communities.

---

## ✨ Key Features

### 👤 Citizen Portal
- 📝 Submit anonymous reports.
- 📍 Share location coordinates with reports.
- 🔎 Track report progress using a unique tracking reference.
- 📊 View investigation status.
- 🎁 Check reward eligibility and payment status.
- 💳 Redeem an issued reward code.

### 🏛️ Government Admin Portal
- 🔐 Secure administrator login.
- 📋 View and manage submitted reports.
- 👮 Assign reports to local officers.
- 📈 Monitor investigation progress.
- 📂 Review investigation findings and evidence.
- ✅ Approve, reject, or mark investigations inconclusive.
- 🎁 Configure and grant rewards.
- 💰 View reward and payout records.

### 👮 Local Officer Portal
- 🔐 Secure officer login.
- 📌 View assigned investigations.
- 📝 Update investigation status.
- 📍 Submit investigation GPS coordinates.
- 📎 Upload supporting evidence.
- 📑 Submit investigation findings.

### 💰 Reward Management
- ⚙️ Configure reward amounts.
- 🎯 Grant rewards to eligible reports.
- 🔑 Generate unique reward codes.
- 💳 Allow citizens to redeem issued codes.
- 📊 Track payout and payment status.

---

## 🛠️ Technology Stack

| Category | Technology |
|---|---|
| 🎨 Frontend | Next.js, React, TypeScript |
| 💅 Styling | Tailwind CSS |
| ⚡ Backend | Python, FastAPI |
| 🗄️ Database | PostgreSQL |
| 🔗 ORM | SQLAlchemy |
| 🔐 Authentication | JWT |
| 📖 API Documentation | Swagger / OpenAPI |
| 💸 Payment Integration | RazorpayX |

---

## 📁 Project Structure

```text
NashaMukt/
│
├── 📂 backend/
│   ├── 📂 app/
│   │   ├── main.py
│   │   ├── routes.py
│   │   ├── models.py
│   │   ├── config.py
│   │   └── ...
│   ├── 📂 migrations/
│   ├── requirements.txt
│   └── .env
│
├── 📂 frontend/
│   ├── 📂 src/
│   │   └── 📂 app/
│   ├── 📂 public/
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

Follow these steps to run NashaMukt locally.

### 1️⃣ Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd nasha_shado
```

### 2️⃣ Backend Setup

```bash
cd backend

python3 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt
```

### 3️⃣ Environment Configuration

Create a `.env` file inside the `backend` directory.

```env
APP_NAME=NashaMukt
DEBUG=True

DATABASE_URL=your_postgresql_database_url

JWT_SECRET_KEY=your_secure_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

FRONTEND_URL=http://localhost:3000
```

Add any other payment-provider variables required by your backend configuration.

> ⚠️ Never upload your `.env` file, database password, JWT secret, or payment credentials to GitHub.

### 4️⃣ Database Setup

- Install and start PostgreSQL.
- Create a database for the project.
- Configure `DATABASE_URL` in `backend/.env`.
- Apply migrations if your Alembic configuration is available:

```bash
alembic upgrade head
```

### 5️⃣ Start the Backend

From the `backend` directory:

```bash
uvicorn app.main:app --reload
```

🌐 Backend: http://127.0.0.1:8000

📖 API Documentation: http://127.0.0.1:8000/docs

### 6️⃣ Frontend Setup

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

🌐 Frontend: http://localhost:3000

---

## 🔄 How It Works

```mermaid
flowchart TD
    A["👤 Citizen submits anonymous report"] --> B["🏛️ Administrator reviews report"]
    B --> C["👮 Report assigned to officer"]
    C --> D["🔍 Officer investigates"]
    D --> E["📎 Findings and evidence submitted"]
    E --> F["✅ Administrator reviews investigation"]
    F --> G["📋 Report completed"]
    G --> H["🎁 Reward eligibility and grant"]
    H --> I["💰 Citizen redeems reward"]
```

---

## 🔐 Security & Privacy

- 🕵️ Anonymous citizen reporting.
- 🔑 JWT-based authentication.
- 🛡️ Role-based access for administrators and officers.
- 🔒 Protected investigation evidence.
- ⚙️ Secure backend environment configuration.
- 💳 Secure handling of reward and payment operations.

---

## 🔮 Future Enhancements

- 🔗 Secure private tracking links.
- 📱 QR-code-based report tracking.
- 🔔 Real-time investigation notifications.
- 📊 Advanced analytics and dashboards.
- 🧾 Enhanced evidence verification.
- 🔐 Multi-factor authentication and audit logging.
- ☁️ Production deployment and monitoring.

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Commit your changes.
5. Submit a pull request.

---

## ❤️ Our Vision

NashaMukt aims to encourage safer communities by providing an accessible way to report suspected drug-related activities while supporting transparent investigation workflows.

<p align="center">
  <strong>🌱 Together for a Drug-Free Society 🌱</strong>
</p>

<p align="center">
  🛡️ <strong>NashaMukt — Report Responsibly. Build a Safer Tomorrow.</strong>
</p>
<img width="2902" height="1540" alt="image" src="https://github.com/user-attachments/assets/cf1dbc22-0f00-4906-ae20-3e0041320688" />
<img width="2926" height="1634" alt="image" src="https://github.com/user-attachments/assets/bb4d3449-9895-4bab-a036-be45775efc22" />
<img width="2810" height="1650" alt="image" src="https://github.com/user-attachments/assets/ea92cc56-d54c-4af8-a81a-2d84229d44f0" /><img width="2896" height="1692" alt="image" src="https://github.com/user-attachments/assets/e4a0fdb7-07ca-4883-b9ce-61525ce71968" />
<img width="2896" height="1692" alt="image" src="https://github.com/user-attachments/assets/5b394d76-92d0-41da-89a6-87b8bf56d06a" />
<img width="2604" height="1622" alt="image" src="https://github.com/user-attachments/assets/46f64f5a-2dae-4f40-9af3-720fe9d00553" />
<img width="2896" height="1692" alt="image" src="https://github.com/user-attachments/assets/4e692d62-3f5f-4fe5-bef0-e2bcc959c6de" />
<img width="2896" height="1692" alt="image" src="https://github.com/user-attachments/assets/560acaa1-3902-4b38-9425-05e8971e42aa" />
<img width="1858" height="1460" alt="image" src="https://github.com/user-attachments/assets/71707c69-41f0-4d13-9786-858b7c494094" />







