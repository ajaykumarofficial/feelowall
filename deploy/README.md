# Deploying Aerowell to AWS

```
GitHub push ─► Actions: test ─► build image ─► push to ECR ─► SSM Run Command ─► EC2 (docker run)
                                                                                    ▲
Browser ─► ALB :443 ─► EC2 :80 ─► container :5000 (API + React app)                 │
Browser ─► S3 / CloudFront (wallpaper images, never touch the server)    health: GET /health
```

Account `576946302445`, region `ap-southeast-2`, ECR repository `aerowell`
(created automatically by the first workflow run).

## One-time setup

### 1. IAM role for the EC2 instance

Create role **`aerowell-ec2`** (trusted entity: EC2) and attach:

- `AmazonSSMManagedInstanceCore` (AWS managed) – lets GitHub Actions reach the instance through SSM
- `AmazonEC2ContainerRegistryReadOnly` (AWS managed) – pull images
- inline policy **`aerowell-app`**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadEnvParameter",
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:ap-southeast-2:576946302445:parameter/aerowell/production/env"
    },
    {
      "Sid": "WallpaperUploads",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::aerowell/feelowall/*"
    }
  ]
}
```

### 2. EC2 instance

- Amazon Linux 2023, `t3.small` or larger, instance profile `aerowell-ec2`
- Tag **`App` = `aerowell`** (the workflow deploys to every running instance with this tag)
- Security group: inbound TCP 80 **from the ALB's security group only**; no SSH needed
- Docker is installed by the deploy script on first run if it's missing

### 3. Application Load Balancer

- Target group: protocol HTTP, port 80, target type instance, register the instance
- Health check path **`/health`**, success code `200`, interval 15s, healthy threshold 2
  (`/health` returns 503 when MongoDB is unreachable, so the ALB stops sending traffic)
- Listeners: HTTPS 443 with an ACM certificate → target group; HTTP 80 → redirect to 443
- Idle timeout: 60s is fine; raise to 120s if large uploads time out

### 4. Production environment in Parameter Store

Copy [production.env.example](production.env.example) to `production.env`, fill it in, then:

```bash
aws ssm put-parameter --region ap-southeast-2 --name /aerowell/production/env \
  --type SecureString --tier Standard --overwrite --value file://production.env
rm production.env
```

### 5. IAM user for GitHub Actions

Create user **`aerowell-github-deploy`** with this inline policy, then create an access key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": [
        "ecr:DescribeRepositories",
        "ecr:CreateRepository",
        "ecr:PutLifecyclePolicy",
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:ap-southeast-2:576946302445:repository/aerowell"
    },
    {
      "Sid": "SsmSendToTaggedInstances",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ec2:ap-southeast-2:576946302445:instance/*",
      "Condition": { "StringEquals": { "ssm:resourceTag/App": "aerowell" } }
    },
    {
      "Sid": "SsmRunShellScript",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ssm:ap-southeast-2::document/AWS-RunShellScript"
    },
    {
      "Sid": "SsmReadResults",
      "Effect": "Allow",
      "Action": [
        "ssm:ListCommands",
        "ssm:ListCommandInvocations",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    }
  ]
}
```

### 6. GitHub repository settings

Settings → Secrets and variables → Actions:

| Kind     | Name                    | Value                                                   |
|----------|-------------------------|---------------------------------------------------------|
| Secret   | `AWS_ACCESS_KEY_ID`     | access key of `aerowell-github-deploy`                  |
| Secret   | `AWS_SECRET_ACCESS_KEY` | its secret                                              |
| Variable | `APP_URL`               | public site address, e.g. `https://aerowell.com.au` (no trailing slash) |

## Day to day

- **Deploy:** push to `main`/`master`, or Actions → *Deploy to AWS* → *Run workflow*.
- **Change a setting:** update the SSM parameter, then re-run the workflow.
- **Roll back:** Actions → pick the last good run → *Re-run all jobs* (re-deploys that commit's image).
- **Logs:** Systems Manager → Session Manager → connect to the instance → `sudo docker logs -f aerowell`.

If the new container doesn't pass `/health` within 90 seconds, the deploy script puts
the previous container back and the workflow fails with the container's last log lines.

## Read-heavy traffic (100 reads : 2 uploads)

- Images are served straight from S3 and never pass through the server. Put CloudFront in front
  of the bucket and set `S3_PUBLIC_URL` to the distribution URL: edge caching, lower S3 cost,
  faster in Australia and abroad.
- Frontend files under `/assets/` are content-hashed and sent with a one-year cache header.
- To scale out, launch more instances with the same tag and register them in the target group;
  the workflow deploys to them one at a time, so the site stays up during deploys.
  Move uploads to S3 first (they already are once `AWS_S3_BUCKET` is set) and turn on
  `USE_REDIS=true` with ElastiCache so the job queue is shared.
