# TopNet Demo Prompts & Examples

Quick reference for impressive demo examples and edge cases.

---

## 🎯 Recommended Demo Prompts

### Best First Demo (Simple & Impressive)
```
I need a simple web application with a PostgreSQL database
```
**Why:** Shows full stack (EC2 + RDS), costs ~$21/mo, deploys in 5-7 mins

---

## 📝 More Demo Prompts by Complexity

### TIER 1 Examples (Cheap, Single AZ)

#### Minimal Web Server
```
Deploy a single web server for my portfolio website
```
**Resources:** VPC, Subnet, IGW, Security Group, EC2
**Cost:** ~$8/mo
**Deploy time:** 2-3 mins

#### Web + Database (Recommended)
```
I need a web application with a database backend
```
**Resources:** VPC, Subnets, IGW, Security Groups, EC2, RDS
**Cost:** ~$21/mo
**Deploy time:** 5-7 mins

#### Startup MVP
```
I'm building a startup MVP - need a backend API with PostgreSQL database
```
**Resources:** Same as above, emphasizes startup-friendly pricing
**Cost:** ~$28/mo

#### Dev Environment
```
Create a simple development environment with a database for testing
```
**Resources:** VPC, Subnet, Security Groups, EC2, RDS
**Cost:** ~$25/mo

---

### TIER 2 Examples (Production, Multi-AZ, HA)

#### Production Web App
```
I need a production web application with high availability and a PostgreSQL database
```
**Resources:** VPC, 2 Public Subnets, 2 Private Subnets, IGW, NAT Gateway, ALB, 2 EC2, RDS Multi-AZ
**Cost:** ~$120/mo
**Deploy time:** 10-15 mins

#### Load Balanced Application
```
Deploy a web app behind a load balancer for redundancy
```
**Resources:** Includes ALB, multiple AZs, NAT gateway
**Cost:** ~$100/mo

---

## 🔄 Modification Prompts (After Initial Topology)

### Add Redundancy
```
Add a second web server for redundancy
```
**Result:** Adds another EC2 instance

### Scale Up
```
Increase the database instance to db.t3.small
```
**Result:** Upgrades RDS instance class

### Change Engine
```
Switch the database from Postgres to MySQL
```
**Result:** Regenerates with MySQL RDS

### Add Resource
```
Add a Redis cache to the infrastructure
```
**Result:** Adds ElastiCache instance (if implemented)

### Security Hardening
```
Restrict SSH access to only my IP address
```
**Result:** Updates security group rules

---

## 💡 Edge Cases & Error Handling Demos

### Free Tier Limitation (Shows Error Handling)
```
Deploy a production environment with t3.large instances
```
**Result:** May fail if free tier, shows error messages gracefully

### Invalid Request (Shows AI Understanding)
```
I need a blockchain mining rig on AWS
```
**Result:** AI explains this isn't a typical infrastructure pattern

### Cost-Conscious User
```
What's the absolute cheapest way to host a website?
```
**Result:** AI recommends minimal setup, explains TIER 1 optimizations

---

## 🎨 Visual Demo Highlights

### Show Node Inspection
1. Generate any topology
2. Click on **EC2 instance** node
3. Point out editable fields:
   - instance_type
   - associate_public_ip
   - security_groups
4. Click on **RDS node**
5. Show database config:
   - engine
   - engine_version
   - instance_class
   - allocated_storage

### Show Validation Warnings
After generating topology, point to validation panel:
- "Security group allows SSH from anywhere" → Security risk
- "Database not configured for Multi-AZ" → Production readiness
- Click warning to highlight affected nodes

---

## 💰 Cost Comparison Demo

### Show Cost Difference

**Prompt 1 (TIER 1):**
```
I need a web app with database for my hobby project
```
**Expected cost:** ~$21-28/mo

**Prompt 2 (TIER 2):**
```
I need a production-ready web app with high availability and load balancing
```
**Expected cost:** ~$100-120/mo

**Talking point:**
> "Notice the cost difference? By default, we optimize for TIER 1 unless you explicitly need production features. That's a $90/month savings!"

---

## 🚀 Quick Demo Paths

### 3-Minute Lightning Demo
1. Landing page → Click "Web Application" template
2. Show topology in editor (30s)
3. Deploy tab → Start plan (show estimate)
4. Skip to Monitor tab (show pre-deployed)

### 5-Minute Standard Demo
1. Chat: "web app with database"
2. View topology, click nodes
3. Deploy: plan → confirm → show terminal
4. Monitor: show EC2 + RDS
5. Wrap up

### 10-Minute Full Demo
Follow the full DEMO_SCRIPT.md

---

## 🎤 Impressive One-Liners for Demos

When generating topology:
> "In seconds, TopNet just designed a complete AWS architecture that would take hours to set up manually."

When showing cost:
> "We're using TIER 1 optimization - single availability zone, no expensive NAT gateway, no load balancer. Perfect for MVPs and hobby projects."

When deploying:
> "Behind the scenes, TopNet generates Terraform JSON and provisions everything to your real AWS account. No mock environments."

When showing monitor:
> "This is live data from AWS. I can click any resource to jump directly to the AWS Console."

When comparing to alternatives:
> "Compare this to manually writing Terraform HCL, or clicking through the AWS Console for an hour, or learning CloudFormation YAML."

---

## 🐛 Handling Demo Failures

### If Deployment Fails

**Stay calm, show the error:**
> "Interesting! We hit an error - let me show you TopNet's error handling. See how it displays the exact Terraform error message? This is actually valuable for debugging."

**Common failures:**
- RDS free tier restriction → Explain AWS limits
- Credentials issue → Show validation of AWS setup
- Timeout → Show that infrastructure deployment takes time

### If UI Glitches

> "The beauty of open-source projects - we can fix this! Let me show you the Monitor tab instead, where I have a pre-deployed environment."

### If RDS Takes Too Long

> "RDS instances typically take 5-10 minutes to provision. In the interest of time, let me show you a pre-deployed environment in the Monitor tab."

---

## 📊 Stats to Mention

- **Time saved:** "Manual AWS setup: 1-2 hours. TopNet: 5 minutes."
- **Terraform lines:** "This topology is ~200 lines of Terraform. You didn't write a single line."
- **Cost optimization:** "TIER 1 saves ~$90/month compared to default AWS setups."
- **Resources:** "We just provisioned 17 AWS resources with one click."

---

## 🎯 Target Audience Customization

### For Developers:
- Emphasize the Terraform generation
- Show the terminal output
- Explain the topology as code
- Mention extensibility

### For Founders/Non-Technical:
- Focus on cost ($21/mo vs $100/mo)
- Emphasize "no coding required"
- Show quick time-to-market
- Highlight the visual editor

### For Students:
- Mention learning AWS architecture visually
- Emphasize free tier compatibility
- Show monitoring to understand resources
- Explain real-world infrastructure patterns

### For DevOps Engineers:
- Show Terraform JSON generation
- Explain validation rules
- Discuss infrastructure patterns (TIER 1 vs 2)
- Show destroy/cleanup workflow

---

**Mix and match these prompts to create the perfect demo for your audience! 🎯**
