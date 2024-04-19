# WebRTC Video Conference - Media Server

This repository contains the code for a WebRTC-based video conferencing application that utilizes a media server for real-time communication. It allows users to join rooms, share video streams, and communicate with each other seamlessly.

## Features

- **Real-time Video Conferencing**: Users can join rooms and engage in video conferencing with other participants in real time.
- **Dynamic Room Creation**: Rooms are created dynamically when the first user joins, allowing for flexible usage.
- **WebRTC Technology**: Utilizes WebRTC technology for peer-to-peer communication, ensuring low-latency and high-quality video streams.
- **Kurento Media Server**: Integrates with Kurento Media Server for advanced media processing capabilities, such as transcoding and mixing.

## Installation

To set up the application locally, follow these steps:

1. Clone the repository to your local machine:

      git clone https://github.com/TejasN09/WebRtc-Kurento.git

2. Install dependencies:

      cd webrtc-video-conference
      npm install

3. Start the server:

      npm start

4. Open the application in your web browser:

      http://localhost:3000

### Installing and Running Kurento Media Server

Kurento Media Server needs to be installed and running on your machine. The recommended method is to use Docker:

1. Install Docker on your machine if you haven't already.

2. Pull the Kurento Media Server Docker image:

      docker pull kurento/kurento-media-server:latest

3. Run Kurento Media Server as a Docker container:

      docker run -d --name kms -p 8888:8888 kurento/kurento-media-server:latest

## Usage

1. Enter your username and the desired room name.
2. Click on the "Enter" button to join the room.
3. Once inside the room, you can see other participants and engage in video conferencing.

## Technologies Used

- **Node.js**: Backend server environment for running the application.
- **Express.js**: Web framework for Node.js used to handle HTTP requests.
- **Socket.io**: WebSocket library for real-time communication between the server and clients.
- **Kurento Media Server**: Open-source media server for WebRTC-based applications.
- **WebRTC**: Real-time communication protocol for peer-to-peer audio, video, and data transfer.
