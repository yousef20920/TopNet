#!/usr/bin/env python3
"""Check IAM users in the AWS account."""
import boto3
import os

try:
    # Use credentials from environment or AWS config
    iam = boto3.client('iam')

    print("=" * 60)
    print("IAM Users in your AWS Account:")
    print("=" * 60)

    response = iam.list_users()
    users = response.get('Users', [])

    if not users:
        print("No IAM users found.")
    else:
        for user in users:
            username = user['UserName']
            user_id = user['UserId']
            created = user['CreateDate'].strftime('%Y-%m-%d')
            print(f"\n👤 Username: {username}")
            print(f"   User ID: {user_id}")
            print(f"   Created: {created}")

    print("\n" + "=" * 60)
    print("\nCurrent credentials are for user: ", end="")
    sts = boto3.client('sts')
    identity = sts.get_caller_identity()
    current_user = identity['Arn'].split('/')[-1]
    print(f"{current_user}")
    print("=" * 60)

except Exception as e:
    print(f"Error: {e}")
    print("\nMake sure you have AWS credentials configured:")
    print("  aws configure")
