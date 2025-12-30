# app/core/pricing.py
"""AWS Pricing estimation for topology resources."""

import os
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.types import TopologyGraph, NodeKind


# Fallback prices (us-east-1, on-demand, Linux) - used if API fails
FALLBACK_EC2_PRICES = {
    "t2.micro": 0.0116,
    "t2.small": 0.023,
    "t2.medium": 0.0464,
    "t3.micro": 0.0104,
    "t3.small": 0.0208,
    "t3.medium": 0.0416,
    "t3.large": 0.0832,
    "m5.large": 0.096,
    "m5.xlarge": 0.192,
}

FALLBACK_RDS_PRICES = {
    "db.t3.micro": 0.017,
    "db.t3.small": 0.034,
    "db.t3.medium": 0.068,
    "db.t3.large": 0.136,
    "db.m5.large": 0.171,
}

# Other AWS resource costs (approximate monthly)
OTHER_COSTS = {
    "nat_gateway": 0.045,  # per hour
    "alb": 0.0225,  # per hour (LCU costs extra)
    "eip": 0.005,  # per hour when not attached
}


def get_ec2_price(instance_type: str, region: str = "us-east-1") -> float | None:
    """Get EC2 on-demand price from AWS Pricing API."""
    try:
        # Pricing API is only available in us-east-1 and ap-south-1
        pricing = boto3.client('pricing', region_name='us-east-1')
        
        response = pricing.get_products(
            ServiceCode='AmazonEC2',
            Filters=[
                {'Type': 'TERM_MATCH', 'Field': 'instanceType', 'Value': instance_type},
                {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': region_to_location(region)},
                {'Type': 'TERM_MATCH', 'Field': 'operatingSystem', 'Value': 'Linux'},
                {'Type': 'TERM_MATCH', 'Field': 'tenancy', 'Value': 'Shared'},
                {'Type': 'TERM_MATCH', 'Field': 'preInstalledSw', 'Value': 'NA'},
                {'Type': 'TERM_MATCH', 'Field': 'capacitystatus', 'Value': 'Used'},
            ],
            MaxResults=1
        )
        
        if response['PriceList']:
            import json
            price_data = json.loads(response['PriceList'][0])
            terms = price_data.get('terms', {}).get('OnDemand', {})
            for term in terms.values():
                for price_dimension in term.get('priceDimensions', {}).values():
                    price = float(price_dimension['pricePerUnit']['USD'])
                    if price > 0:
                        return price
        
        return None
    except Exception as e:
        print(f"[pricing] Failed to get EC2 price: {e}")
        return None


def get_rds_price(instance_class: str, engine: str, region: str = "us-east-1") -> float | None:
    """Get RDS on-demand price from AWS Pricing API."""
    try:
        pricing = boto3.client('pricing', region_name='us-east-1')
        
        # Map engine names
        db_engine = "PostgreSQL" if engine == "postgres" else "MySQL"
        
        response = pricing.get_products(
            ServiceCode='AmazonRDS',
            Filters=[
                {'Type': 'TERM_MATCH', 'Field': 'instanceType', 'Value': instance_class},
                {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': region_to_location(region)},
                {'Type': 'TERM_MATCH', 'Field': 'databaseEngine', 'Value': db_engine},
                {'Type': 'TERM_MATCH', 'Field': 'deploymentOption', 'Value': 'Single-AZ'},
            ],
            MaxResults=1
        )
        
        if response['PriceList']:
            import json
            price_data = json.loads(response['PriceList'][0])
            terms = price_data.get('terms', {}).get('OnDemand', {})
            for term in terms.values():
                for price_dimension in term.get('priceDimensions', {}).values():
                    price = float(price_dimension['pricePerUnit']['USD'])
                    if price > 0:
                        return price
        
        return None
    except Exception as e:
        print(f"[pricing] Failed to get RDS price: {e}")
        return None


def region_to_location(region: str) -> str:
    """Convert AWS region code to pricing API location name."""
    region_map = {
        "us-east-1": "US East (N. Virginia)",
        "us-east-2": "US East (Ohio)",
        "us-west-1": "US West (N. California)",
        "us-west-2": "US West (Oregon)",
        "ca-central-1": "Canada (Central)",
        "eu-west-1": "EU (Ireland)",
        "eu-west-2": "EU (London)",
        "eu-west-3": "EU (Paris)",
        "eu-central-1": "EU (Frankfurt)",
        "eu-north-1": "EU (Stockholm)",
        "ap-northeast-1": "Asia Pacific (Tokyo)",
        "ap-northeast-2": "Asia Pacific (Seoul)",
        "ap-southeast-1": "Asia Pacific (Singapore)",
        "ap-southeast-2": "Asia Pacific (Sydney)",
        "ap-south-1": "Asia Pacific (Mumbai)",
        "sa-east-1": "South America (Sao Paulo)",
    }
    return region_map.get(region, "US East (N. Virginia)")


def estimate_topology_cost(topology: TopologyGraph) -> dict[str, Any]:
    """Estimate monthly cost for a topology."""
    
    costs = {
        "items": [],
        "hourly_total": 0.0,
        "monthly_total": 0.0,
        "currency": "USD",
        "note": "Estimates based on on-demand pricing. Actual costs may vary.",
    }
    
    # Get region from first node
    region = "us-east-1"
    if topology.nodes:
        region = topology.nodes[0].region or "us-east-1"
    
    hours_per_month = 730  # Average
    
    for node in topology.nodes:
        item = None
        
        if node.kind == NodeKind.COMPUTE_INSTANCE:
            instance_type = node.props.get("instance_type", "t3.micro")
            
            # Try API first, fall back to hardcoded
            hourly = get_ec2_price(instance_type, region)
            if hourly is None:
                hourly = FALLBACK_EC2_PRICES.get(instance_type, 0.0104)
            
            item = {
                "resource": node.name,
                "type": f"EC2 ({instance_type})",
                "hourly": hourly,
                "monthly": hourly * hours_per_month,
            }
        
        elif node.kind == NodeKind.DATABASE:
            instance_class = node.props.get("instance_class", "db.t3.micro")
            engine = node.props.get("engine", "postgres")
            
            # Try API first, fall back to hardcoded
            hourly = get_rds_price(instance_class, engine, region)
            if hourly is None:
                hourly = FALLBACK_RDS_PRICES.get(instance_class, 0.017)
            
            item = {
                "resource": node.name,
                "type": f"RDS {engine} ({instance_class})",
                "hourly": hourly,
                "monthly": hourly * hours_per_month,
            }
        
        elif node.kind == NodeKind.GATEWAY:
            gateway_type = node.props.get("gateway_type", "")
            if gateway_type == "nat":
                hourly = OTHER_COSTS["nat_gateway"]
                item = {
                    "resource": node.name,
                    "type": "NAT Gateway",
                    "hourly": hourly,
                    "monthly": hourly * hours_per_month,
                }
        
        elif node.kind == NodeKind.LOAD_BALANCER:
            hourly = OTHER_COSTS["alb"]
            item = {
                "resource": node.name,
                "type": "Application Load Balancer",
                "hourly": hourly,
                "monthly": hourly * hours_per_month,
            }
        
        if item:
            costs["items"].append(item)
            costs["hourly_total"] += item["hourly"]
            costs["monthly_total"] += item["monthly"]
    
    # Round totals
    costs["hourly_total"] = round(costs["hourly_total"], 4)
    costs["monthly_total"] = round(costs["monthly_total"], 2)
    
    # Add free tier note if applicable
    if costs["monthly_total"] < 20:
        costs["free_tier_note"] = "Some resources may be covered by AWS Free Tier for new accounts."
    
    return costs
