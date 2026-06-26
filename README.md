# E-Transport - Fleet Management System

E-Transport is a comprehensive, real-time fleet management solution designed to streamline transport services. It provides a seamless experience for administrators, drivers, and passengers through dedicated web and mobile interfaces.

## ✨ Key Features

- **Real-Time GPS Tracking**: Administrators and passengers can monitor vehicle locations live on a map.
- **Role-Based Dashboards**:
    - **Admin Dashboard**: Oversee all drivers, manage system payments, and monitor the entire fleet.
    - **Driver Dashboard**: Manage routes, view assigned passengers, track payments, and broadcast live location during trips.
    - **Passenger Dashboard**: View driver's live location, manage personal pickup/drop-off points, report absences, and book extra seats.
- **Dynamic Route Management**: Drivers can define multiple routes (e.g., morning and evening) with specific start times and via points.
- **Passenger & Booking Management**:
    - Passengers can easily join a vehicle's roster using its unique number.
    - Report absences for specific dates and periods (morning, evening, or full day).
    - Check seat availability and book extra seats for guests on specific trips.
- **Automated Billing & Payments**:
    - Passengers can upload monthly payment receipts for driver approval.
    - Drivers can upload system fee receipts for admin approval.
    - A clear history of payments with their status (Pending, Approved, Rejected) is available to all parties.
- **Interactive Maps**: Leverages Leaflet for displaying routes, live locations, and passenger pickup/drop-off points.

## 🛠️ Tech Stack

- **Frontend**: React, React Router, Tailwind CSS, Axios, Leaflet
- **Backend**: Node.js, Express, Mongoose, Socket.IO
- **Authentication**: Firebase Authentication
- **Database**: MongoDB

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- MongoDB instance
- Firebase project for authentication

### Backend Setup

1.  Navigate to the `backend` directory: `cd backend`
2.  Install dependencies: `npm install`
3.  Create a `.env` file and add your environment variables (MongoDB URI, Firebase config, etc.).
4.  Start the server: `npm start`

### Frontend Setup

1.  Navigate to the `web` directory: `cd web`
2.  Install dependencies: `npm install`
3.  Create a `.env` file and add your `VITE_API_URL` and Firebase configuration.
4.  Start the development server: `npm run dev`

The application should now be running on your local machine.