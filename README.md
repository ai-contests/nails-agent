# Nails-Agent

Nails-Agent is an AI-powered end-to-end intelligent operations system for the nail industry. It leverages cutting-edge generative AI to solve key pain points: difficulty in user decision-making and low operational efficiency for merchants. The system features high-precision virtual try-ons and autonomous decision-making agents, creating a complete digital loop from consumer interaction to strategic merchant intervention.

## Table of Contents
- [Getting Started](#getting-started)
  - [1. Environment Preparation](#1-environment-preparation)
  - [2. Environment Variable Configuration](#2-environment-variable-configuration)
  - [3. Data Initialization](#3-data-initialization)
  - [4. Start Development Server](#4-start-development-server)
- [Project Objectives](#project-objectives)

## Getting Started

### 1. Environment Preparation
Ensure you have Node.js (v20+) and Bun (recommended) installed.
```bash
# Install dependencies
npm install
```

### 2. Environment Variable Configuration
Copy `.env.example` to `.env` and fill in the required information:
- `MODELSCOPE_API_KEY`: API key for LLM services (used for Agent decisions and chat).
- `COMFYCLOUD_API_KEY`: API key for the try-on rendering pipeline.
- `ROBOFLOW_API_KEY`: API key for visual feature extraction.

### 3. Data Initialization
Execute a single command to perform feature extraction, database schema creation, and seed data import.
```bash
npm run setup
```

### 4. Start Development Server
```bash
npm run dev
```
Access the consumer interface at `http://localhost:3000` and the administrative dashboard at `http://localhost:3000/zh/admin`.

## Project Objectives
The core objective of Nails-Agent is to provide a practical and measurable AI solution for the industry. By offering a "what you see is what you get" virtual try-on experience, it aims to increase conversion rates. Simultaneously, it utilizes AI Agents to replace traditional manual operations with automated, data-driven precision, serving as an engineering blueprint for the digital transformation of the nail industry.
