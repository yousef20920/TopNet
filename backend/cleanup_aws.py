#!/usr/bin/env python3
"""Clean up orphaned TopNet resources from AWS."""

import boto3
import time
import os
from pathlib import Path

# Load credentials from .env file
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# Region where resources were deployed
REGION = 'us-east-2'  # User confirmed this is the region

def cleanup_topnet_resources():
    """Delete all TopNet-tagged resources in proper order."""

    ec2 = boto3.client('ec2', region_name=REGION)
    rds = boto3.client('rds', region_name=REGION)

    print("🔍 Scanning for TopNet resources...")
    print(f"Region: {REGION}")
    print("-" * 60)

    # 1. Find and terminate EC2 instances
    print("\n📦 Checking EC2 instances...")
    instances = ec2.describe_instances(
        Filters=[
            {'Name': 'tag:ManagedBy', 'Values': ['TopNet']},
            {'Name': 'instance-state-name', 'Values': ['running', 'pending', 'stopped', 'stopping']}
        ]
    )

    instance_ids = []
    for reservation in instances['Reservations']:
        for instance in reservation['Instances']:
            instance_ids.append(instance['InstanceId'])
            name = next((tag['Value'] for tag in instance.get('Tags', []) if tag['Key'] == 'Name'), 'unnamed')
            print(f"  Found: {instance['InstanceId']} ({name}) - {instance['State']['Name']}")

    if instance_ids:
        print(f"\n🗑️  Terminating {len(instance_ids)} EC2 instance(s)...")
        ec2.terminate_instances(InstanceIds=instance_ids)
        print("  ✓ Termination initiated. Waiting for instances to terminate...")
        waiter = ec2.get_waiter('instance_terminated')
        waiter.wait(InstanceIds=instance_ids)
        print("  ✓ All instances terminated")
    else:
        print("  ✓ No EC2 instances found")

    # 2. Find and delete RDS instances
    print("\n📊 Checking RDS instances...")
    try:
        db_instances = rds.describe_db_instances()
        topnet_dbs = [db for db in db_instances['DBInstances']
                      if any(tag.get('Key') == 'ManagedBy' and tag.get('Value') == 'TopNet'
                             for tag in rds.list_tags_for_resource(
                                 ResourceName=db['DBInstanceArn'])['TagList'])]

        for db in topnet_dbs:
            db_id = db['DBInstanceIdentifier']
            print(f"  Found: {db_id} ({db['DBInstanceStatus']})")
            print(f"  🗑️  Deleting RDS instance {db_id}...")
            rds.delete_db_instance(
                DBInstanceIdentifier=db_id,
                SkipFinalSnapshot=True,
                DeleteAutomatedBackups=True
            )
            print(f"  ✓ Deletion initiated for {db_id}")

        if not topnet_dbs:
            print("  ✓ No RDS instances found")
    except Exception as e:
        print(f"  ⚠️  Error checking RDS: {e}")

    # 3. Find and delete DB subnet groups
    print("\n🔗 Checking DB Subnet Groups...")
    try:
        subnet_groups = rds.describe_db_subnet_groups()
        topnet_groups = [sg for sg in subnet_groups['DBSubnetGroups']
                        if 'main-db' in sg['DBSubnetGroupName'] or 'topnet' in sg['DBSubnetGroupName'].lower()]

        for sg in topnet_groups:
            sg_name = sg['DBSubnetGroupName']
            print(f"  Found: {sg_name}")
            # Wait a bit for RDS to be deleted first
            time.sleep(5)
            try:
                rds.delete_db_subnet_group(DBSubnetGroupName=sg_name)
                print(f"  ✓ Deleted subnet group: {sg_name}")
            except Exception as e:
                print(f"  ⚠️  Could not delete {sg_name}: {e}")

        if not topnet_groups:
            print("  ✓ No DB subnet groups found")
    except Exception as e:
        print(f"  ⚠️  Error checking DB subnet groups: {e}")

    # 4. Find and delete security groups
    print("\n🔒 Checking Security Groups...")
    sgs = ec2.describe_security_groups(
        Filters=[{'Name': 'tag:ManagedBy', 'Values': ['TopNet']}]
    )

    sg_ids = []
    for sg in sgs['SecurityGroups']:
        if sg['GroupName'] != 'default':
            sg_ids.append(sg['GroupId'])
            print(f"  Found: {sg['GroupId']} ({sg['GroupName']})")

    if sg_ids:
        print(f"\n🗑️  Deleting {len(sg_ids)} security group(s)...")
        for sg_id in sg_ids:
            try:
                ec2.delete_security_group(GroupId=sg_id)
                print(f"  ✓ Deleted: {sg_id}")
            except Exception as e:
                print(f"  ⚠️  Could not delete {sg_id}: {e}")
    else:
        print("  ✓ No security groups found")

    # 5. Find and delete subnets
    print("\n🌐 Checking Subnets...")
    subnets = ec2.describe_subnets(
        Filters=[{'Name': 'tag:ManagedBy', 'Values': ['TopNet']}]
    )

    subnet_ids = []
    for subnet in subnets['Subnets']:
        subnet_ids.append(subnet['SubnetId'])
        name = next((tag['Value'] for tag in subnet.get('Tags', []) if tag['Key'] == 'Name'), 'unnamed')
        print(f"  Found: {subnet['SubnetId']} ({name})")

    if subnet_ids:
        print(f"\n🗑️  Deleting {len(subnet_ids)} subnet(s)...")
        for subnet_id in subnet_ids:
            try:
                ec2.delete_subnet(SubnetId=subnet_id)
                print(f"  ✓ Deleted: {subnet_id}")
            except Exception as e:
                print(f"  ⚠️  Could not delete {subnet_id}: {e}")
    else:
        print("  ✓ No subnets found")

    # 6. Find and delete internet gateways
    print("\n🌍 Checking Internet Gateways...")
    igws = ec2.describe_internet_gateways(
        Filters=[{'Name': 'tag:ManagedBy', 'Values': ['TopNet']}]
    )

    for igw in igws['InternetGateways']:
        igw_id = igw['InternetGatewayId']
        print(f"  Found: {igw_id}")

        # Detach from VPCs first
        for attachment in igw.get('Attachments', []):
            vpc_id = attachment['VpcId']
            print(f"  🔓 Detaching from VPC {vpc_id}...")
            try:
                ec2.detach_internet_gateway(InternetGatewayId=igw_id, VpcId=vpc_id)
                print(f"  ✓ Detached from {vpc_id}")
            except Exception as e:
                print(f"  ⚠️  Could not detach: {e}")

        # Delete IGW
        try:
            ec2.delete_internet_gateway(InternetGatewayId=igw_id)
            print(f"  ✓ Deleted: {igw_id}")
        except Exception as e:
            print(f"  ⚠️  Could not delete {igw_id}: {e}")

    if not igws['InternetGateways']:
        print("  ✓ No internet gateways found")

    # 7. Find and delete route tables (non-main)
    print("\n🗺️  Checking Route Tables...")
    route_tables = ec2.describe_route_tables(
        Filters=[{'Name': 'tag:ManagedBy', 'Values': ['TopNet']}]
    )

    for rt in route_tables['RouteTables']:
        rt_id = rt['RouteTableId']
        is_main = any(assoc.get('Main', False) for assoc in rt.get('Associations', []))

        if not is_main:
            print(f"  Found: {rt_id}")
            try:
                ec2.delete_route_table(RouteTableId=rt_id)
                print(f"  ✓ Deleted: {rt_id}")
            except Exception as e:
                print(f"  ⚠️  Could not delete {rt_id}: {e}")

    if not route_tables['RouteTables'] or all(any(assoc.get('Main', False) for assoc in rt.get('Associations', [])) for rt in route_tables['RouteTables']):
        print("  ✓ No route tables found (excluding main)")

    # 8. Find and delete VPCs
    print("\n🏢 Checking VPCs...")
    vpcs = ec2.describe_vpcs(
        Filters=[{'Name': 'tag:ManagedBy', 'Values': ['TopNet']}]
    )

    for vpc in vpcs['Vpcs']:
        vpc_id = vpc['VpcId']
        name = next((tag['Value'] for tag in vpc.get('Tags', []) if tag['Key'] == 'Name'), 'unnamed')
        print(f"  Found: {vpc_id} ({name})")

        try:
            ec2.delete_vpc(VpcId=vpc_id)
            print(f"  ✓ Deleted: {vpc_id}")
        except Exception as e:
            print(f"  ⚠️  Could not delete {vpc_id}: {e}")

    if not vpcs['Vpcs']:
        print("  ✓ No VPCs found")

    print("\n" + "=" * 60)
    print("✅ Cleanup complete!")
    print("=" * 60)

if __name__ == '__main__':
    try:
        cleanup_topnet_resources()
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
