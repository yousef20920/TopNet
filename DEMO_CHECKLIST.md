# TopNet Demo Checklist

Print this and keep it handy during your demo!

---

## ✅ Pre-Demo Setup (5 minutes before)

- [ ] Start backend: `cd backend && python3 main.py`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open browser to `http://localhost:5173`
- [ ] Verify AWS credentials in `backend/.env`
- [ ] Clean up old AWS resources (run `cleanup_aws.py` if needed)
- [ ] Close unnecessary browser tabs
- [ ] Set browser zoom to 100%
- [ ] Have AWS Console open in another tab
- [ ] Test your microphone (if presenting live)
- [ ] Full screen the browser window

---

## 🎯 Demo Flow (10 mins)

### 1. Landing Page (1 min)
- [ ] Show template cards
- [ ] Hover to see pricing
- [ ] Explain TIER 1 vs TIER 2

### 2. Generate Topology (2 min)
- [ ] Type: "I need a web application with a database"
- [ ] Show AI response with cost estimate
- [ ] Click "View Topology"

### 3. Design View (2 min)
- [ ] Zoom/pan the canvas
- [ ] Click EC2 node → Show inspector
- [ ] Point out VPC, subnets, security groups, RDS
- [ ] Show validation warnings in bottom right

### 4. Chat Modifications (1 min)
- [ ] Type: "Add a second web server"
- [ ] Show updated topology
- [ ] Show updated cost

### 5. Deploy (3 min)
- [ ] Click "Deploy" tab
- [ ] Click "Start Deployment Plan"
- [ ] Review plan (resources, cost)
- [ ] Click "Confirm & Deploy"
- [ ] Show terminal output
- [ ] Wait for success (or skip if pre-deployed)

### 6. Monitor (2 min)
- [ ] Click "Monitor" tab
- [ ] Show account info at top
- [ ] Show resource cards (EC2, VPC, RDS)
- [ ] Click EC2 instance → Opens AWS Console
- [ ] Show RDS endpoint
- [ ] Click RDS → Opens AWS Console

### 7. Destroy (1 min)
- [ ] Back to "Deploy" tab
- [ ] Click "Destroy Infrastructure"
- [ ] Show terminal cleanup

### 8. Recap (1 min)
- [ ] Summarize 5 key features
- [ ] Mention use cases
- [ ] Thank audience

---

## 💬 Key Talking Points

**Opening:**
> "TopNet is an AI-powered infrastructure-as-code platform that generates AWS infrastructure from natural language."

**TIER System:**
> "We default to TIER 1 - optimized for hobby projects at ~$28/mo. No NAT gateways, no load balancers, single AZ."

**Visual Editor:**
> "This interactive topology shows the relationships between resources. Click any node to inspect or modify it."

**Deployment:**
> "Behind the scenes, TopNet generates Terraform JSON and deploys it to your AWS account."

**Monitor:**
> "Live dashboard pulls real-time data from AWS. Click any resource to jump to the Console."

**Cost Optimization:**
> "We use db.t2.micro (free tier) and t3.micro instances to keep costs minimal."

---

## 🔧 Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Backend not running | Check port 3001: `lsof -i :3001` |
| Frontend not loading | Clear browser cache, restart dev server |
| AWS credentials error | Verify `.env` file, check IAM permissions |
| Deployment fails | Show error in terminal, explain validation |
| RDS takes too long | Use pre-deployed environment |
| Page won't load | Check console for errors (F12) |

---

## ⏱️ Time Management

**10-minute demo:**
- Landing: 1 min
- Design: 3 min
- Deploy: 3 min
- Monitor: 2 min
- Wrap: 1 min

**5-minute demo:**
- Landing: 30s
- Design: 1 min
- Deploy: 1.5 min
- Monitor: 1 min
- Wrap: 30s

**Skip if running late:**
- Chat modifications
- Node inspector details
- Destroy process

---

## 📊 Demo Backup Plan

If live demo fails:
1. Have screenshots ready
2. Pre-record a video
3. Show pre-deployed resources in Monitor tab
4. Walk through the topology JSON files

---

## 🎬 Showmanship Tips

✅ **DO:**
- Smile and show enthusiasm
- Point with cursor to guide attention
- Pause after key moments
- Ask "Any questions?" throughout
- Show passion for solving the problem

❌ **DON'T:**
- Rush through the UI
- Apologize for bugs ("this usually works")
- Read from script word-for-word
- Hide errors (show them, explain them)
- Skip the cost optimization story

---

## 📱 Quick Reference URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- AWS Console: `https://console.aws.amazon.com`
- GitHub (if applicable): `https://github.com/yourusername/TopNet`

---

**Remember: You know this app inside and out. Be confident! 🚀**
