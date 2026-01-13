# TopNet

> Natural-Language Cloud Network Topology Copilot

Turn plain-English infrastructure descriptions into validated, deployable cloud network topologies (graph + Terraform).

## Features

- 🗣️ **Natural Language Input** - Describe your infrastructure in plain English
- 📊 **Visual Graph Editor** - Interactive topology visualization with React Flow
- ✅ **Validation** - Automatic checks for overlapping CIDRs, orphaned nodes, security issues
- 📄 **Terraform Output** - Generate deployment-ready Terraform JSON
- 🚀 **One-Click Deploy** - Deploy directly to AWS with Terraform

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Terraform CLI (for deployment)
- AWS credentials configured (for deployment)

### Installation

```bash
# Clone the repo
git clone https://github.com/yousef20920/TopNet.git
cd TopNet

# Install and run everything
./start.sh
```

Or manually:

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .
uvicorn app.main:app --port 3001 --reload

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### AWS Deployment Setup

To enable deployment to AWS:

1. **Install Terraform CLI**
   ```bash
   # macOS
   brew install terraform
   
   # Or download from https://terraform.io/downloads
   ```

2. **Configure AWS Credentials**
   ```bash
   # Option 1: AWS CLI
   aws configure
   
   # Option 2: Environment variables
   export AWS_ACCESS_KEY_ID="your_access_key"
   export AWS_SECRET_ACCESS_KEY="your_secret_key"
   export AWS_DEFAULT_REGION="us-east-1"
   ```

3. **Deploy!**
   - Generate a topology
   - Click "🚀 Deploy to AWS"
   - Review the plan
   - Click "Apply" to deploy

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs

## Project Structure

```
TopNet/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── core/           # Types & data structures
│   │   ├── api/            # REST endpoints
│   │   ├── builder/        # Spec → Graph builder
│   │   ├── validation/     # Validation passes
│   │   └── terraform/      # Terraform generation
│   └── pyproject.toml
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api/            # API client
│   │   └── types/          # TypeScript types
│   └── package.json
└── start.sh               # Run both servers
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, React Flow, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic, NetworkX |
| IaC Output | Terraform JSON |

## Roadmap

- [x] **Phase 1** - Skeleton & types, hardcoded topology, graph visualization
- [x] **Phase 2** - Spec → Graph builder, NL parsing stubs
- [x] **Phase 3** - Validation passes (CIDR overlap, orphaned nodes, reachability)
- [x] **Phase 4** - Terraform generation for AWS
- [x] **Phase 5** - Polish, better layout, editable properties

## License

MIT
