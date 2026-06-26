# 🚨 LifeRoute — Smart Ambulance Dispatch & Hospital Alert System

A real-time emergency ambulance dispatch web application built as a final year project.

## 🎯 What It Does
- User selects emergency type (Heart Attack, Trauma, Breathing Difficulty, Other)
- Enters patient details and picks location on an interactive map
- System finds nearest hospitals with live route calculation
- Confirms dispatch and sends instant Telegram notification to hospital
- Saves all emergency records to Firebase Realtime Database

## 🛠️ Tech Stack
| Technology | Purpose |
|---|---|
| React + Vite | Frontend UI |
| React Router | Page navigation |
| google Maps | Interactive map & routing |
| Firebase Realtime DB | Emergency data storage |
| Telegram Bot API | Hospital alert notifications |
| Tailwind CSS | Styling |

## 📁 Project Structure

src/

├── pages/

│   ├── EmergencyType.jsx      # Emergency selection screen

│   ├── EmergencyDetails.jsx   # Patient info + map location

│   └── Confirmation.jsx       # Confirm & notify hospital

├── components/

│   └── MapComponent.jsx       # Leaflet map component

└── utils/

├── firebase.js            # Firebase connection

├── notifications.js       # Telegram bot alerts

└── routing.js             # Route calculation

## 👨‍💻 Developer
**Mohammed Rizwan**  
B.Tech Computer Science — SR University, Warangal  
[LinkedIn](https://linkedin.com/in/mohammedriizwan) |
[GitHub](https://github.com/riizwannx)




