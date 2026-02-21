# TopNet Demo Script

**Duration:** 10-15 minutes
**Audience:** Developers, DevOps engineers, or anyone interested in cloud infrastructure

---

## 🎬 Introduction (1 min)

**Opening:**
> "Hi! Today I'm going to show you TopNet - an AI-powered infrastructure-as-code platform that lets you design, deploy, and monitor AWS infrastructure through natural language conversations. No Terraform expertise required."

**Key value props:**
- Generate AWS infrastructure from plain English descriptions
- Visual topology editor with real-time validation
- One-click deployment with cost estimates
- Live monitoring of deployed resources

---

## 🚀 Part 1: Landing Page & Quick Start (2 min)

### Step 1: Show Landing Page
1. Open `http://localhost:5173`
2. Point out the clean, modern interface

**Say:**
> "When you first land on TopNet, you're greeted with quick-start templates. These are pre-configured infrastructure patterns for common use cases."

### Step 2: Browse Templates
Hover over each template card:
- **Web Application** (~$28/mo) - EC2 + Database
- **Startup MVP** (~$28/mo) - API + PostgreSQL
- **Game Server** (~$30/mo) - 4GB RAM
- **Dev Environment** (~$28/mo) - Testing setup
- **Personal VPN** (~$8/mo) - Cheapest option
- **Portfolio + Forms** (~$20/mo) - Website with DB

**Say:**
> "Notice the cost estimates? TopNet defaults to TIER 1 - optimized for hobby and MVP projects. This uses single availability zones, no NAT gateways, and no load balancers to keep costs under $30/month."

### Step 3: Custom Request
Click in the chat input and type:
```
I need a web application with a database for my startup
```

Press Enter.

**Say:**
> "But you're not limited to templates. You can describe any infrastructure in plain English. Watch as TopNet understands my request..."

---

## 🎨 Part 2: Design View - Topology Generation (3 min)

### Step 4: Show Generation Process
Watch the chat response appear:
- AI confirms what it will create
- Shows resource count and cost estimate
- Provides a button to "View Topology"

**Say:**
> "The AI analyzed my request and is generating a topology with approximately 17 resources. Notice the cost estimate - $21/month for TIER 1."

### Step 5: Open Editor
Click "View Topology" button.

**Say:**
> "And here we are in the Design view. This is an interactive visual editor powered by React Flow."

### Step 6: Explore the Topology Canvas
- **Zoom in/out** using mouse wheel
- **Pan** by dragging
- **Click on nodes** to inspect them

Point out the topology structure:
- VPC (network boundary)
- Subnets (public subnet in us-east-2a)
- Security groups (web-sg, db-sg)
- EC2 instance (web server)
- RDS database (PostgreSQL)
- Internet Gateway (for internet access)

**Say:**
> "Each node represents an AWS resource. The connections show relationships - like which security groups protect which instances."

### Step 7: Click on a Node
Click on the **EC2 instance** node.

**Say:**
> "When I click a node, the Node Inspector opens on the right. Here I can see and edit all properties of this resource."

Show the Node Inspector:
- Instance type: `t3.micro`
- Public IP: enabled
- Security groups
- Tags

**Say:**
> "I can modify these properties directly. For example, if I wanted a larger instance, I could change `t3.micro` to `t3.small`."

### Step 8: Show Validation Panel
Point to the validation panel in the bottom right.

**Say:**
> "TopNet automatically validates your infrastructure. Here it's warning us about the security group allowing SSH from anywhere - which is a security risk. And it's suggesting we enable Multi-AZ for production workloads."

Click on a validation warning to highlight the affected node.

---

## 💬 Part 3: Chat-Based Modifications (2 min)

### Step 9: Modify via Chat
In the left sidebar chat panel, type:
```
Add a second web server for redundancy
```

**Say:**
> "Instead of manually dragging nodes, I can just ask the AI to modify the topology. Let me add another web server..."

Watch as:
- AI confirms the change
- New topology generates
- Cost updates to reflect the additional EC2 instance

### Step 10: Another Modification (Optional)
Type:
```
Change the database from Postgres to MySQL
```

**Say:**
> "The AI understands infrastructure changes and can regenerate the entire topology with the new configuration."

---

## 🚀 Part 4: Deployment Pipeline (3 min)

### Step 11: Navigate to Deploy Tab
Click on the **Deploy** tab in the header.

**Say:**
> "Now comes the magic - one-click deployment to AWS. TopNet converts our visual topology into Terraform JSON behind the scenes."

### Step 12: Start Deployment
Point out the deployment pipeline visualization:
- Connect → Plan → Review → Apply → Complete

Click **"Start Deployment Plan"** button.

**Say:**
> "Watch as TopNet connects to AWS, generates a Terraform plan, and shows us exactly what will be created."

### Step 13: Review the Plan
Wait for the plan to complete (10-20 seconds).

Show the Review panel:
- **Resource count:** 17 resources
- **Estimated cost:** ~$21/month
- **Resource list:** All AWS resources that will be created

**Say:**
> "Before deploying anything, TopNet shows us a detailed plan. We can see all 17 AWS resources that will be created, from VPCs to security groups to the database instance."

### Step 14: Confirm & Deploy
Click **"Confirm & Deploy"** button.

**Say:**
> "When I'm ready, I click Confirm & Deploy. This runs `terraform apply` and provisions everything to my AWS account."

### Step 15: Watch Terminal Output
Expand the terminal output at the bottom.

**Say:**
> "The terminal shows real-time progress. You can see Terraform creating each resource one by one. This usually takes 5-10 minutes because RDS databases take time to provision."

Point out the log messages:
```
✓ aws_vpc.vpc_main created
✓ aws_subnet.subnet_public created
✓ aws_security_group.sg_web created
...
```

**Wait for deployment to complete** (or skip to next section if demoing pre-deployed resources).

### Step 16: Deployment Complete
When status changes to **Complete**:

**Say:**
> "Success! Our infrastructure is now live in AWS. TopNet shows the deployment ID and we can see all resources are provisioned."

---

## 📊 Part 5: Monitor View (3 min)

### Step 17: Navigate to Monitor Tab
Click on the **Monitor** tab.

**Say:**
> "Now let's check what we just deployed. The Monitor tab connects to AWS and shows live status of all our resources."

### Step 18: Show Dashboard Sections

**Account Status:**
> "At the top, we see our AWS account info - Account ID, region (us-east-2), and current user."

**Resource Cards:**
Point to the grid of resource cards:
- **EC2 Instances:** 2 running
- **VPCs:** 1 active
- **Security Groups:** 2
- **RDS Instances:** 1

**Say:**
> "These cards show counts of active resources across our AWS account."

### Step 19: Show EC2 Details
Scroll to the **EC2 Instances** section.

**Say:**
> "Here are our two web servers. Each card shows the instance state, type, and availability zone."

**Click on an EC2 instance card.**

**Say:**
> "When I click, it opens the AWS Console directly to this instance. TopNet generates the exact AWS Console URL for quick access."

*(Browser opens AWS Console - quickly close it)*

### Step 20: Show RDS Details
Scroll to the **RDS Databases** section.

**Say:**
> "Here's our PostgreSQL database. We can see it's running, using a `db.t2.micro` instance in us-east-2a with 20GB of storage."

Point out the endpoint:
```
main-db.xxxxxxxxx.us-east-2.rds.amazonaws.com:5432
```

**Say:**
> "The endpoint is displayed here - this is what our application would use to connect to the database."

**Click on the RDS instance card** to open AWS Console (optional).

### Step 21: Show VPC Details
Scroll to the **VPCs** section.

**Say:**
> "And here's our VPC - the network boundary containing all our resources. CIDR block 10.0.0.0/16 gives us 65,000+ IP addresses to work with."

---

## 🗑️ Part 6: Cleanup & Destroy (2 min)

### Step 22: Navigate Back to Deploy Tab
Click on **Deploy** tab.

**Say:**
> "When we're done with this infrastructure, cleanup is just as easy as deployment."

### Step 23: Destroy Infrastructure
Scroll down to find **"Destroy Infrastructure"** button (appears after successful deployment).

Click **"Destroy Infrastructure"**.

**Say:**
> "TopNet runs `terraform destroy` to tear down everything cleanly. This ensures we're not charged for resources we're no longer using."

Watch terminal output showing resources being deleted:
```
Destroying aws_db_instance.rds_main...
Destroying aws_instance.ec2_instance...
...
✓ Infrastructure destroyed successfully
```

---

## 🎯 Part 7: Key Features Recap (1 min)

**Summarize the demo:**

> "So to recap, with TopNet you can:"

1. **Design** - Describe infrastructure in plain English, get visual topology
2. **Validate** - Real-time warnings about security and cost
3. **Deploy** - One-click Terraform deployment with cost estimates
4. **Monitor** - Live dashboard of AWS resources with direct Console links
5. **Modify** - Chat-based infrastructure changes, no code editing
6. **Destroy** - Clean teardown when you're done

**Highlight the tier system:**
> "TopNet defaults to TIER 1 - single AZ, no NAT, no load balancer - keeping costs under $30/month. Perfect for hobby projects and MVPs. When you need production-grade HA, just say 'I need a production setup' and it switches to TIER 2."

---

## 🎤 Closing (1 min)

**Say:**
> "TopNet bridges the gap between infrastructure-as-code and no-code tools. You get the flexibility of Terraform without writing a single line of HCL. The AI handles the complexity while you focus on describing what you need."

**Use cases:**
- Rapid prototyping for startups
- Learning AWS architecture
- Personal projects on a budget
- Quick test environments
- Portfolio/demo applications

**Thank the audience:**
> "Thanks for watching! Questions?"

---

## 📝 Demo Tips

### Before the Demo:
1. ✅ Make sure backend is running (`python3 main.py`)
2. ✅ Make sure frontend is running (`npm run dev`)
3. ✅ AWS credentials configured in `.env`
4. ✅ Clean AWS account (run cleanup script if needed)
5. ✅ Browser zoom level at 100%
6. ✅ Close unnecessary tabs
7. ✅ Have AWS Console open in another tab (for quick verification)

### During the Demo:
- **Pace yourself** - Don't rush through the UI
- **Highlight hover effects** - Show the polish in the design
- **Point with your cursor** - Help viewers follow along
- **Explain AWS costs** - Emphasize the TIER 1 optimization
- **Show the terminal** - Developers love seeing the real Terraform output

### If Something Goes Wrong:
- **Deployment fails?** → Show the error handling, emphasize "this is why we validate"
- **AWS credentials issue?** → Pre-record a backup video
- **Slow RDS creation?** → Have a pre-deployed environment ready to show Monitor tab

### Advanced Demo (If Time Permits):
- Show the **Node Inspector** editing live properties
- Demonstrate **validation warnings** by clicking to highlight nodes
- Show **cost differences** between TIER 1 and TIER 2 (e.g., "production with load balancer")
- Connect to the deployed EC2 instance via SSH
- Show the actual database endpoint in action

---

## 🎬 Alternative: Quick 5-Minute Demo

If you only have 5 minutes:

1. **Landing page** (30s) - Show templates
2. **Generate topology** (1m) - "web app with database"
3. **Visual editor** (1m) - Click nodes, show inspector
4. **Deploy** (1.5m) - Plan → Confirm → Show terminal
5. **Monitor** (1m) - Show live resources, click to AWS Console
6. **Wrap up** (30s) - Key features recap

---

## 📹 Video Recording Tips

If recording a video demo:
- Use **1920x1080 resolution**
- Record browser window only (no desktop clutter)
- Add **background music** (low volume, non-distracting)
- Include **text overlays** for key points
- Add **zoom-ins** when showing small UI elements
- **Speed up** long waits (RDS creation) with time-lapse

---

**Good luck with your demo! 🚀**
