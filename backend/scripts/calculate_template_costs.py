#!/usr/bin/env python3
"""Calculate accurate costs for landing page templates using AWS Pricing API."""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.pricing import estimate_topology_cost, get_ec2_price, get_rds_price, OTHER_COSTS

def calculate_template_costs():
    """Calculate costs for each template."""

    region = "us-east-2"  # Ohio - our default region
    hours_per_month = 730

    templates = {
        "Personal VPN": {
            "ec2": [("t3.micro", 1)],  # (instance_type, count)
            "rds": [],
            "alb": 0,
            "nat": 0,
        },
        "Portfolio + Forms": {
            "ec2": [("t3.micro", 1)],
            "rds": [("db.t3.micro", "mysql", 1)],
            "alb": 0,
            "nat": 0,
        },
        "Game Server": {
            "ec2": [("t3.medium", 1)],  # 4GB RAM
            "rds": [],
            "alb": 0,
            "nat": 0,
        },
        "WordPress/Blog": {
            "ec2": [("t3.small", 1)],
            "rds": [("db.t3.micro", "mysql", 1)],
            "alb": 1,
            "nat": 0,
        },
        "Startup MVP Backend": {
            "ec2": [("t3.micro", 2)],  # HA with 2 instances
            "rds": [("db.t3.micro", "postgres", 1)],
            "alb": 1,
            "nat": 1,
        },
        "Dev Environment": {
            "ec2": [("t3.micro", 2), ("t3.small", 1)],  # Staging + prod
            "rds": [("db.t3.micro", "postgres", 2)],  # 2 databases
            "alb": 1,
            "nat": 1,
        },
    }

    print("=" * 80)
    print(f"AWS Pricing Estimates for {region} (us-east-2 Ohio)")
    print("=" * 80)
    print()

    for template_name, config in templates.items():
        total = 0.0
        components = []

        # EC2 instances
        for instance_type, count in config["ec2"]:
            price = get_ec2_price(instance_type, region)
            if price is None:
                print(f"⚠️  Warning: Could not fetch price for {instance_type}, using fallback")
                from app.core.pricing import FALLBACK_EC2_PRICES
                price = FALLBACK_EC2_PRICES.get(instance_type, 0.01)

            monthly_cost = price * hours_per_month * count
            total += monthly_cost
            components.append(f"{count}x {instance_type}: ${monthly_cost:.2f}/mo")

        # RDS databases
        for instance_class, engine, count in config["rds"]:
            price = get_rds_price(instance_class, engine, region)
            if price is None:
                print(f"⚠️  Warning: Could not fetch price for {instance_class} {engine}, using fallback")
                from app.core.pricing import FALLBACK_RDS_PRICES
                price = FALLBACK_RDS_PRICES.get(instance_class, 0.017)

            monthly_cost = price * hours_per_month * count
            total += monthly_cost
            components.append(f"{count}x RDS {engine} ({instance_class}): ${monthly_cost:.2f}/mo")

        # ALB
        if config["alb"] > 0:
            alb_cost = OTHER_COSTS["alb"] * hours_per_month * config["alb"]
            total += alb_cost
            components.append(f"ALB: ${alb_cost:.2f}/mo")

        # NAT Gateway
        if config["nat"] > 0:
            nat_cost = OTHER_COSTS["nat_gateway"] * hours_per_month * config["nat"]
            total += nat_cost
            components.append(f"NAT Gateway: ${nat_cost:.2f}/mo")

        # Print template summary
        print(f"📋 {template_name}")
        print(f"   Total: ${total:.2f}/mo")
        for component in components:
            print(f"   - {component}")
        print()

    print("=" * 80)
    print("Notes:")
    print("- Prices are for On-Demand instances (no Reserved Instance discounts)")
    print("- Data transfer costs not included (typically $0.09/GB outbound after 1GB free)")
    print("- ALB includes base hourly cost only (LCU charges may apply)")
    print("- New AWS accounts get 750 hrs/mo free for t3.micro EC2 and db.t3.micro RDS (12 months)")
    print("=" * 80)

if __name__ == "__main__":
    calculate_template_costs()
