# TopNet Template Cost Breakdown

## Monthly Cost Estimates

All costs are estimates based on us-east-2 (Ohio) pricing. Actual costs may vary based on usage, data transfer, and region.

### Template Pricing

| Template | Monthly Cost | What's Included | Best For |
|----------|-------------|-----------------|----------|
| 🔒 **Personal VPN** | **~$8/mo** | 1x EC2 t3.micro, VPC, Security Group | Cheapest option - secure browsing |
| 🎨 **Portfolio + Forms** | **~$20/mo** | 1x EC2 t3.micro, RDS MySQL db.t3.micro, VPC | Students, freelancers, personal sites |
| 🎮 **Game Server** | **~$30/mo** | 1x EC2 t3.medium (4GB RAM), VPC | Minecraft, Valheim, private gaming |
| 📝 **WordPress/Blog** | **~$44/mo** | 1x EC2 t3.small, RDS MySQL db.t3.micro, ALB, VPC | Small business sites, blogs |
| 🚀 **Startup MVP** | **~$77/mo** | 2x EC2 t3.micro, RDS PostgreSQL db.t3.micro, ALB, NAT Gateway, Multi-AZ VPC | API backends, web apps with HA |
| 💼 **Dev Environment** | **~$104/mo** | 2x EC2 t3.micro + 1x t3.small, 2x RDS db.t3.micro, ALB, NAT Gateway, VPC | Development teams, multi-env setups |

---

## Cost Components Breakdown

### EC2 Instances (Compute)
- **t3.micro** (1GB RAM): ~$7.50/mo (Free Tier eligible - first 750 hours/month free)
- **t3.small** (2GB RAM): ~$15/mo
- **t3.medium** (4GB RAM): ~$30/mo
- **t3.large** (8GB RAM): ~$60/mo

### RDS Database
- **db.t3.micro**: ~$13/mo (Free Tier eligible - first 750 hours/month free)
- **db.t3.small**: ~$26/mo
- **db.t3.medium**: ~$52/mo

### Networking
- **VPC**: Free
- **Application Load Balancer (ALB)**: ~$16/mo + data processed
- **NAT Gateway**: ~$32/mo (for private subnet internet access)
- **Data Transfer**: First 1GB free, then $0.09/GB outbound

---

## AWS Free Tier Benefits

New AWS accounts get 12 months of Free Tier access:
- **750 hours/month** of t3.micro EC2 (enough for 1 instance running 24/7)
- **750 hours/month** of RDS db.t3.micro
- **5GB** of S3 storage
- **1GB** data transfer out

**This means:** A portfolio or VPN template could run **FREE** for the first year!

---

## Cost Optimization Tips

1. **Use Free Tier**: New AWS accounts can run small templates free for 12 months
2. **Right-size instances**: Start with t3.micro, scale up only when needed
3. **Auto-stop dev environments**: Only run staging/dev when actively using
4. **Reserved Instances**: Save up to 40% for long-running production workloads
5. **Monitor with AWS Cost Explorer**: Set billing alerts to avoid surprises

---

## Comparison with Alternatives

| Service | Basic Plan | TopNet Equivalent |
|---------|-----------|-------------------|
| **Heroku** | $7/mo (dyno) + $9/mo (database) = **$16/mo** | Portfolio: $20/mo (more control, AWS) |
| **DigitalOcean** | $12/mo (droplet) + $15/mo (database) = **$27/mo** | WordPress: $44/mo (includes load balancer) |
| **Railway** | ~$20/mo for small app | MVP: $77/mo (HA + production-ready) |
| **Render** | $7/mo (web) + $7/mo (db) = **$14/mo** | Portfolio: $20/mo (AWS ecosystem) |

**Why AWS?**
- Industry standard (80%+ of companies use it)
- Resume/portfolio value
- Scales to millions of users
- 200+ services available as you grow
- Full infrastructure ownership

---

## Example: Monthly Bill for Startup MVP

```
EC2 (2x t3.micro instances):          $15.18
RDS PostgreSQL (db.t3.micro):          $12.41
Application Load Balancer:             $16.43
NAT Gateway:                           $32.85
Data Transfer:                          Free
VPC/Networking:                         Free
---------------------------------------------
TOTAL:                                ~$76.87/mo
```

*Prices based on AWS us-east-2 (Ohio) on-demand rates via AWS Pricing API*

---

## Next Steps

1. Click a template on the landing page
2. Chat with AI to customize your setup
3. See detailed cost breakdown before deploying
4. Deploy with one click
5. Monitor costs in real-time via AWS dashboard

**Questions?** All templates show exact resource counts and costs before you commit.
